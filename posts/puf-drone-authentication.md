---
title: No key at rest: identifying a drone from its silicon
description: Why I built a UAV authentication system on Physical Unclonable Functions, and what it means for a device to have no stored secret to steal.
date: 2026-11-18
tags: hardware security, puf, uav, authentication
featured: false
---
Most device authentication starts with a secret key written into flash. If an attacker can read the flash, or clone the chip, they have the identity. For a drone that may be captured, that is a real problem.

## What a PUF is

A **Physical Unclonable Function** uses tiny, uncontrollable manufacturing differences in silicon. Given the same challenge, one chip answers differently from another, and the same chip answers consistently. The identity is a property of the physical device, not a number stored on it.

## Deriving keys on demand

In my UAV authentication project, keys are **derived on demand from the PUF response**. Nothing secret is stored on the device, so there is nothing at rest to extract or clone. Power the chip off and the key is gone; ask the hardware again and it can be rebuilt.

## What makes it hard

Real PUF responses are slightly noisy, and a key must come out identical every time. In practice that means error correction around the raw response before any key is derived from it. The security argument also changes: instead of protecting a stored secret, you protect the interface that lets an attacker query the hardware.

## Why drones

A drone operates far from its owner and can be physically captured. Binding its identity to its own silicon raises the cost of impersonating it, which is the property I wanted to explore.

Source: [github.com/5aranx/PUF-Based-Drone-Authentication-System](https://github.com/5aranx/PUF-Based-Drone-Authentication-System)
