---
title: KittyPi, Part 2
subtitle: The Door
description: Taking apart the Cat Mate door to see how it works.
date: 2022-12-25
series: kittypi
---

![](/static/img/isa_hide1.jpg)

## Introduction

My cat likes to bring live rodents and birds into the house via her cat door.  In this series of posts I'll document my solution to this problem, which incorporates:

  - A fancy RFID-enabled catdoor that I ordered online (heavily modified),
  - A Raspberry Pi computer with camera, motor driver, and other accessories,
  - Image recognition using the Keras and Tensorflow libraries,
  - All controlled by a custom Python application.

In the [first post in this series](/posts/kittypi-part1-intro), I
described the general approach, as well as some of the design goals
I set for myself.  In this post we'll get a bit more technical as we take apart
the existing cat door to see how it works.

## Preparation

The subject of this post is the
["Cat Mate Elite Super Selective"](https://closerpets.com/collections/cat-flaps/products/elite-microchip-flap-timer-control)
cat door, installed in a ground level window of my basement for seven years at
the time this project began.

![Kidnapped bird not included.](/static/img/bird1.jpg){.mx-auto width=600}

It worked --- it opened, it closed, it locked, it unlocked.  It sensed when something
was pushing on the flap and it knew if they were trying to get in or get out.  But
how exactly did it do these things, and could we control these functions from the
Raspberry Pi?

The heart of the CatMate door is a central control board which I'd seen many
times --- it's exposed whenever you change the batteries.  From this central
board a number of wires head off to parts unknown.  My hope was that I could
determine the function of each wire, disconnect it from the CatMate's controller,
and instead connect it to a Raspberry Pi computer that I could program.
^[Possibly I could instead have attempted to connect the Pi to a serial or debug port of
the CatMate, reprogrammed the CatMate's firmware, and somehow enabled the Pi to
remotely command the CatMate's microcontroller.  I did not investigate this option.]

![](/static/img/door_controller.jpg){.mx-auto width=550}

At the time I was a bit nervous about disassembling (and then modifying) this
catdoor --- I needed it to continue working so Isabelle could get in and out!
^[And it was not cheap.]
There was also no certainty that the project would work at all.  Any number of
roadblocks were possible:

* The various control wires might use a voltage or signaling method incompatible with the Pi.
* The Pi might not have the CPU power required for the image processing task.
* Even if I used an external computer, it might not be possible to design and train
an algorithm to reliably recognize problem images.
* I might not be able to figure out the internal workings of the CatMate.
* I might break something.

Due to all this uncertainty, I proceeded very slowly and cautiously.  I tried to
ensure sure I could always put the door back in operation if I had to abort or
rethink the project.

With the benefit of hindsight, however, let's pretend I knew exactly what I was
doing and dive right into results of the disassembly.

## Overview

By removing a few screws, we can remove the entire front cover to reveal the inner workings:

![](/static/img/door_annotated.jpg)

The Position Sensors and the Latch Assembly are where most of the action is, and
we'll zoom in on each of them in a minute.  First, we can observe a few things
about the rest of the components:

* 4 AA batteries yields 6V, which is very close enough to the Raspberry Pi's 5V
supply and input/output voltage.  That's promising.
* The left hinge has wires running into it --- we'll explore this later.
* There are 12 wires coming out of the Control Board:  A common ground connected to
the negative battery terminal (and several other places), a wire to
the positive battery terminal, two to the RFID antenna, four to the Latch
Assembly, three to the Position Sensors, and one to the left hinge.
* The RFID antenna (marked with a red highlight) runs all the way around the
perimeter of the flap.  We won't explore it any further since I have no intention
of using this feature.

Let's examine the bottom of the door in more detail.

## Position Sensors

The way the door latch and the Position Sensors work together is really interesting:

![](/static/img/latch_annotated.jpg){.mx-auto width=600}

1. These slots in the flap accept..
2. ...these Latch Pins, but there is a bit of play, allowing the flap to swing a
few degrees inward or outward even when it is locked.
3. These two magnets attract each other and keep the flap perfectly centered,
unless something pushes on it.
4. This magnet activates...
5. ...these two carefully placed
[magnetic reed switches](/https://en.wikipedia.org/wiki/Reed_switch),
which together allow the controller to detect whether the flap is centered,
pushed slightly inward, or pushed slightly outward.

With a bit of careful attention and probing with a voltmeter, we can figure out how
to interpret the reed switches.  Each switch is normally closed by spring tension,
meaning that it will
conduct electricity when the magnet is **not** close by.  In this situation the black
ground wire is shorted to the colored sense wire, forcing it to 0V.  When the magnet
**is** close enough,
^[In a quiet room, you can actually hear the faint click as the switch opens or
closes when the magnet moves into or out of range.]
it pulls the ground and sense wires apart, allowing the
[pull-up resistor](https://en.wikipedia.org/wiki/Pull-up_resistor) in the control
board to bring the sense wire up to 5V.

Bottom line:  Magnet close = 5 Volts.  No magnet = 0 Volts.

![This is acually a normally-open reed switch, but you get the idea.](/static/img/reedswitch_drawing.png){.mx-auto width=500}

![Reed switches, view from above](/static/img/reed_detail.jpg){.mx-auto width=500}

In this view of the reed switches, we can see that they are mounted in parallel,
diagonal grooves, slightly offset from one another.  The one on the left (**Orange**
wire) activates ^[i.e. opens, i.e. reads 5V] when the flap is perfectly centered.
The one on the right (**Yellow** wire) activates when the door is pushed slightly **in**.
When the door is pushed slightly **out**, neither switch activates.

It's astonishing to me that these inexpensive components can be placed and
calibrated so
precisely that just a few degrees of movement can be *reliably* detected.

Embedded in the left-hand hinge assembly is another magnet paired with another reed
switch:

![Mystery switch](/static/img/mystery_detail.jpg){.mx-auto width=400}

The reed switch is mounted inside the support bracket (shown temporarily
unmounted from the base), while the magnet is embedded into the pivot pin of
the flap itself.

I have no idea what this sensor is for.  I spent a little time on it, probing
with my voltmeter while moving the flap into various positions, but I never saw
it change voltage.  I probably could have figured it out with more effort, but
I decided that I don't really *care*.  The two switches discussed earlier tell us
everything we need to know:

* **Orange HIGH, Yellow LOW**: Flap is centered, nothing happening.
* **Orange LOW, Yellow HIGH**: Kitty (or something) is pushing *inward* on the
flap.  She can't actually get in unless we run the motor to open the latch.
* **Orange LOW, Yellow LOW**: Kitty is pushing *outward* on the
flap.  It's fine if she wants to smuggle things *out* of the
house, so we should unlock the door unconditionally.
* **Orange HIGH, Yellow HIGH**: Not used.
^[This state does occur briefly when the door is pushed
*ever so slightly* inward.  But we can ignore it in practice --- just
ignore the Yellow wire when the Orange wire is HIGH.]

![Isabelle doesn't find this stuff interesting.](/static/img/isa_box2.jpg){.mx-auto width=500}

Since our goal is to control the door from the Raspberry Pi, let's review where
we stand:  We've figured out how to sense the position of the flap, including
whether it's being pushed and in what direction.  We know these sensors read 0 or 5
Volts,
^[With the help of a pull-up resistor on the control board, which is also a built-in
feature of the Pi.  More on this in a later post.]
which is compabitible with the Pi's input pins. So far, so good --- next let's
examine how the door actually locks and unlocks.

## Latch Assembly

The Latch Assembly has two jobs:

* **Move** the Latch Pins into the locked (up) or unlocked (down) positions.
* **Sense** when the Latch Pins are in the locked or unlocked positions.

To accomplish this, a single motor drives two gears.  Each gear turns at the
exact same rate.  One of the gears connects to the Latch Pins and moves them
up and down.  The other connects to an alignment sensor which tracks the position
of both gears and the Latch Pins.

![](/static/img/motor_annotated.jpg)

![Alignment and Latch Pin plates removed for a better view of the gears](/static/img/worm_annotated.jpg)

On the left, a small electric motor
^[Probing with a voltmeter shows that when active, this motor is
connected directly to the battery voltage (5V-6V).  This should make Raspberry Pi
control fairly simple.]
drives a long shaft with two worm gears.  The
[worm gears](https://en.wikipedia.org/wiki/Worm_drive)
transform the high-speed rotation of the motor into lower-speed (but more powerful)
motion of the two toothed gears.  Because those
gears have the same number of teeth, their rotations are exactly synchronized.

To the far right, the Latch Gear incorporates a 
[cam](https://en.wikipedia.org/wiki/Cam)
(small off-centered plastic nub that's hard to see in these photos), which turns
the rotational movement of the gear into up/down movement of the Latch Pin Plate,
causing the door to lock and unlock.

The center section is responsible for sensing the position of the Latch Pins.
The Alignment Gear turns the Alignment Plate, a half-circle of plastic that rotates through the center of
the Photo Interrupter.  For half of its rotation it blocks the gap in the
interrupter, and for the other half it leaves it unblocked.
The Photo Interrupter itself is an optical device that senses when something
is blocking the gap.

If we watch the Alignment Plate and Latch Pin Plate moving as the controller locks
and unlocks the door, we can make some observations:

* The motor always turns in the same direction.  It doesn't rotate one way to lock
and the other way to unlock.
* This results in a continuous up, down, up, down motion of the Latch Pin Plate, and
continuous rotation of the Alignment Plate.
* The Latch Pins reach the fully-up (locked) position *just* as the Alignment Plate
*exits* the gap in the Photo Interrupter.  In other words, the door is locked just when the interrupter
goes from **blocked** to **unblocked**.
* The Latch Pins reach the fully-down (unlocked) position *just* as the Alignment
Plate *enters* the gap in the interrupter, so the door is fully
unlocked just when the interrupter goes from
**unblocked** to **blocked**.

The Photo Interrupter is the most complex individual part here, with four wires
leading to it.  It was pretty obvious that it was designed to sense the presence
of the Alignment Plate, but it took a bit of research to find out exactly how it
works (and what to call it).  Luckily I noticed these markings:

![](/static/img/interrupt_detail.jpg){.mx-auto width=500}

That's "HY" on the top, and the electrical symbol for a diode on the bottom. A bit
of Googling with "hy diode optical sensor" gave me a
[datasheet](http://hyzt.com/manager/upimg/20137815544.pdf)
from "Hing Yip Electronic" in China (and taught me the term "Photo Interrupter"
a.k.a. "Optical Interrupter").

![](/static/img/hy301_diagram.png){.mx-auto width=200}

This diagram from the datasheet shows how it works.  On the left we have an
infrared
[Light Emitting Diode](https://en.wikipedia.org/wiki/Light-emitting_diode)
, which shines IR light across the gap when voltage is applied across pins
1 and 2.  On the right is a
[Phototransistor](https://en.wikipedia.org/wiki/Photodiode#Related_devices)
, which allows electricity to flow *only* when light hits it.  When the light is
blocked, no current can flow between pins 3 and 4.

With this diagram for reference, we can monitor the pins with a voltmeter to
see how the Photo Interrupter is used in this application.
Pins 2 and 4 are both connected to ground (0V).
A voltage of around 1.2V
is applied to pin 1, to turn on the LED.
^[Only while the motor is running --- when the motor is off,
the LED is turned off, presumably to save battery power.
The voltage is less than 5V due to the presence of a *current-limiting resistor*
in the control board, which we'll revisit when we hook everything up to the
Raspberry Pi, in the next post.]
When something blocks the gap in the Photo Interrupter, pin 3 reads HIGH (5V),
and when the gap is unblocked, pin 4 reads LOW (0V).

![Light Emitting Eyes?](/static/img/isa_box3.jpg){.mx-auto width=500}

The relationship between HIGH, LOW, blocked, unblocked, locked and unlocked gets
a bit confusing.  Let's try to put all the pieces together:

* Just as the Latch Pins reach the **locked** position, the Alignment Plate *exits*
the gap of the Photo Interrupter.  This means the Interrupter is now *unblocked*,
so light from the LED can hit the Phototransistor.  This allows it to conduct
electricity, creating a connection from pin 3 to pin 4.  Pin 4 is connected to 0V
(LOW), so now pin 3 (the sense pin) also goes **LOW**.
* Just as the Latch Pins reach the **unlocked** position, the Alignment Plate *enters*
the gap of the Interrupter, which is now *blocked*, so light from the LED can *not*
hit it.  This breaks the connection between pins 3 and 4.  Pin 3 is then forced
**HIGH** (5V) by a pull-up resistor on the control board.

Bottom line:  Unlocked = 5 Volts.  Locked = 0 Volts.

Now finally we can summarize what it would take for the Raspberry Pi to control the
latch.  When we want to lock or unlock, turn on the LED and start the motor.  Wait
for pin 3 of the Phototransistor to change (HIGH to LOW, or LOW to HIGH,
depending on whether we're locking or unlocking the door).  Quickly turn off the
motor (and the LED).  Done!  The entire process takes around 0.3 seconds, so it's
important for the Pi to stop the motor very quickly after the voltage transition.

## Cutting the cord

Mission accomplished! (More or less --- let's just ignore that mystery sensor).  We
understand how to lock and unlock the door, and we know how to detect when the
cat is pushing on the door.  We understand the wiring well enough to create a
circuit diagram showing the purpose of those 12 wires:

<object data="/static/img/diagram-original.svg" width="80%" alt="Diagram" class="mx-auto" style="pointer-events: none;"></object>

What's up with the "DuPont Connectors" shown in the diagram?  Well, we're ready to
dispense with the CatMate's built-in control board, and connect these signals to
the Raspberry Pi instead.  But that will mean physically cutting wires, which will
definitely break the catdoor!  Remember that we'd like to be able to restore the
door to its current working state, if the project doesn't work out.

What we'll do is splice pluggable connectors
^[I happened to have 4-pin and 6-pin DuPont connectors on hand, which is why
the diagram shows an empty spot in each connector.]
into the middle of the wires, so that we
can plug into either the control board, or the Pi.

![](/static/img/dupont_detail.jpg){.inline width=250}
![](/static/img/dupont_kit.jpg){.inline width=400}
{.text-center}

Doing this is a bit of a chore:
We need to cut each wire, strip the ends, crimp them into male and female
pins with a special tool, and insert the pins into the mating connectors.
I won't walk through the steps here --- if you're interested,
[this site](https://www.mattmillman.com/info/crimpconnectors/dupont-and-dupont-connectors/)
is a good starting point.

Once the connectors are installed, we can plug the male and female connectors
together, reconnecting the sensors and motor with the CatMate's control board.
And voila, now we have... a cat door that does exactly what it did before!  But now
we can wire the Raspberry Pi to another set
of DuPont connectors, and swap between the CatMate's built-in controller and the Pi.

Next time, we'll do exactly that!