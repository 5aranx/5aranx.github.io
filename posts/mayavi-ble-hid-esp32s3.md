---
title: Mayavi: the decisions behind a BLE HID framework on the ESP32-S3
description: What it takes to make one ESP32-S3 behave as a keyboard, mouse, gamepad and media remote, and which security trade-offs I chose to document instead of hide.
date: 2026-11-24
tags: embedded, ble, esp32-s3, firmware
featured: true
---
Mayavi is firmware that turns an ESP32-S3 into a **Bluetooth LE HID device**. One board can present itself as a keyboard, a mouse, a gamepad or a media remote, using 11 selectable profiles. It also runs a Wi-Fi access point with a browser dashboard, and there is a serial console for when neither radio is convenient.

## One device, many identities

A HID device is mostly a descriptor: a small blob that tells the host what reports to expect. Switching profile means switching the descriptor and the report layout, so the host sees a different device. Keeping 11 of them selectable is mainly a data-structure problem, and the firmware stays readable if each profile is data rather than a branch in the main loop.

## Never block the loop

The payload runner is **non-blocking**. A delay that sleeps the CPU also stalls the BLE stack, the access point and the dashboard, so every step is scheduled against a clock instead. Settings live in NVS so they survive a reboot, and the dashboard talks to a JSON API served from LittleFS.

## Trade-offs worth writing down

Two defaults are deliberately simple:

- **The access point is open by default.** That makes first setup easy, and it also means anyone in range can join the network. It is documented, and it should be changed before real use.
- **Pairing uses Just Works.** It needs no PIN, but it offers no protection against a man-in-the-middle during pairing.

A tool that can type on a computer for you is powerful, so the repository also states its **authorized-use limits**. Writing the trade-offs down next to the code costs very little, and it makes the project honest about what it is.

Source: [github.com/5aranx/Mayavi](https://github.com/5aranx/Mayavi)
