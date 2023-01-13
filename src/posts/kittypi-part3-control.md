---
title: KittyPi, Part 3
subtitle: Controlling Stuff
description: Write something here
date: 2022-12-31
series: kittypi
---

![](/static/img/isa_hide1.jpg)

## Introduction

My cat likes to bring live rodents and birds into the house via her cat door.  In this series of posts I'll document my solution to this problem, which incorporates:

  - A fancy RFID-enabled catdoor that I ordered online (heavily modified),
  - A Raspberry Pi computer with camera, motor driver, and other accessories,
  - Image recognition using the Keras and Tensorflow libraries,
  - All controlled by a custom Python application.

```mermaid
  %%{init: { "theme": "default" } }%%
  %%{init: { "flowchart": { "curve": "linear" } } }%%
  graph TB

  CAM("Raspberry Pi<br>Camera")
  subgraph PI [Raspberry Pi]
    CC([Camera<br>Controller])
    DC([Door<br>Controller])
    CC -.->|ALERT!| DC
  end
  MD("Motor Driver<br>HAT")
  subgraph DOOR [Catdoor]
    SEN("Door&Latch<br>Sensors")
    MOT(Latch Motor)
  end
  CAM --> CC
  SEN --> DC --> MD --> MOT
  linkStyle 0 stroke:red,stroke-width:3px,color:red;
```
<object data="/static/img/diagram-full.svg" width="100%" alt="Diagram" style="pointer-events: none;"></object>
