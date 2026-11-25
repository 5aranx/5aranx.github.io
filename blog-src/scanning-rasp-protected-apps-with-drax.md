---
title: Drax: scanning Android apps that defend themselves
description: Notes on building a mobile app security scanner whose checks keep working when the app under test is protected by RASP.
date: 2026-11-12
tags: security, android, frida, rasp
featured: false
---
Drax is a Python scanner paired with an Android agent that talks over **ADB**. It runs about 50 checks across three styles: static, dynamic, and Frida-based instrumentation. It is built for **authorised assessments only**.

## The problem with RASP

Runtime Application Self-Protection lets an app watch its own environment. Typical triggers are a rooted device, an attached debugger or a hooking framework. When one fires, the app may refuse to run or change its behaviour, and a naive scanner then reports nothing useful.

## Design goals

- **Keep working inside protected apps.** The scanner has to tolerate an app that reacts to being observed.
- **Mix static and dynamic evidence.** Static checks read what is shipped; dynamic and Frida checks observe what actually happens at runtime. The two together find more than either alone.
- **Stay in scope.** A scanner that touches real apps needs explicit authorisation, so the tool is documented as for authorised assessments only.

## What I learned

My SafeSkillz internship involved decompiling Android apps to study runtime behaviour, permissions and signs of malicious behaviour. That work showed how different an app looks on disk and at runtime, and it is the idea Drax is built around.
