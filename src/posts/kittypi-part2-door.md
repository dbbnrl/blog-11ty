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
ensure I could always put the door back in operation if I had to abort or
rethink the project.

With the benefit of hindsight, however, let's pretend I knew exactly what I was
doing and dive right into results of the disassembly.

## Overview

By removing a few screws, we can remove the entire front cover to reveal the inner workings:

![](/static/img/door_annotated.jpg)

The Position Sensors and the Latch Assembly are where most of the action is, and
we'll zoom in on each of them in a minute.  First, we can observe a few things
about the rest of the components:

* 4 AA batteries yields 6 Volts, which appears to be regulated to 5V
^[Based on measurements of some of the output wires.]
on the control
board.  The Raspberry Pi uses 3.3V for its Input / Output (I/O)
pins, so we'll have to keep that difference in mind.
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
[magnetic reed switches](https://en.wikipedia.org/wiki/Reed_switch),
which together allow the controller to detect whether the flap is centered,
pushed slightly inward, or pushed slightly outward.

![These are Normally Open reed switches, which only conduct electricity when
a magnetic field pulls the contacts together.](/static/img/reedswitch_drawing.png){.mx-auto width=500}

![Reed switches, view from above](/static/img/reed_detail.jpg){.mx-auto width=500}

In this view of the reed switches, we can see that they are mounted in parallel,
diagonal grooves, slightly offset from one another.  When the flap is perfectly
centered, both switches are *active* (closed).
^[Because the magnet is close enough to both of them.]
When the flap is pushed slightly **IN**, the left switch
*deactivates* (opens), leaving only the right switch active.  When the
flap is pushed slightly **OUT**, the reverse situation occurs.
^[In a quiet room, you can actually hear the faint clicks of the switches opening and
closing as the magnet moves into or out of range.]

<figure>
<video playsinline autoplay controls muted loop><source src="/static/img/reed_switch.webm"></video>
<figcaption>Interaction of magnet and reed switches.</figcaption>
</figure>

The state of the switches can be determined by watching the voltage on the
**Orange** and **Yellow** sense wires.  These wires are normally high (5V) due to 
[pull-up resistors](https://en.wikipedia.org/wiki/Pull-up_resistor)
in the control board.  However, when the reed switches are *active* (closed),
one or both of the sense wires is shorted to Ground (0V) through the switches.
In electrical terminology these are *Active LOW* sensors, because the low (0V)
voltage corresponse to the "activated" state, while the high (5V) voltage is the
inactive, default state.

The possible states of the **Orange** and **Yellow** wires are:
* **Orange LOW**: Flap is centered, nothing happening. (**Yellow** will always be
**LOW** in this situation, but we don't care either way.)
* **Orange HIGH, Yellow LOW**: Kitty (or something) is pushing **inward** on the
flap.  She can't actually get in unless we run the motor to open the latch.
* **Orange HIGH, Yellow HIGH**: Kitty is pushing **outward** on the
flap.  It's fine if she wants to smuggle things *out* of the
house, so we should unlock the door unconditionally.

Using the active LOW convention, we can say that **Orange** means "**Centered**",
and **Yellow** means "**Pushed IN**".

We're not done yet!  Embedded in the left-hand hinge assembly is another magnet
paired with another reed switch.
This switch is designed to detect when the door is *wide* open (i.e., the cat is
actually pushing her body through the opening).  Obviously this can only happen if
the door is unlocked.

![Left hinge. The reed switch runs through the center of the bracket.](/static/img/mystery_detail.jpg){.mx-auto width=400}

The reed switch is mounted inside the support bracket (shown temporarily
unmounted from the base), while the magnet is embedded into the pivot pin of
the flap itself.
As the flap rotates, the magnetic field generated by the hinge
magnet rotates with respect to the fixed reed switch:
* When the flap is *closed*, the field is at right angles to the switch, and does not
affect it.  Thus the switch remains *inactive* (open), and the **Blue** sense wire
is pulled up to 5V on the control board.
* As the flap approaches 90 degrees open (in either direction),
the field aligns with the reed switch
and the contacts close, shorting the sense wire to GND (0V).

So the **Blue** sense wire means "**Wide Open**" (remember it's active LOW).

![Isabelle doesn't find this stuff interesting.](/static/img/isa_box2.jpg){.mx-auto width=500}

Since our goal is to control the door from the Raspberry Pi, let's review where
we stand:  We've figured out how to sense the position of the flap, including
whether it's being pushed, in what direction, and whether it's been opened wide
enough for the cat to pass through.

We know these sensors read 0 or 5 Volts, with the 5V level driven by pull-up
resistors on the control board.  Although the Pi uses 3.3V rather than 5V I/O,
it does come with built-in pull-up resistors that can connect an input to the
internal 3.3V supply.  So if we wire the ground and sense wires
to the Pi and enable pull-up resistors on each of the sense wires, these same sensors
will read 0 or 3.3 Volts.  Perfect!

So far, so good --- next let's examine how the door actually locks and unlocks.

## Latch Assembly

The Latch Assembly has two jobs:

* **Move** the *Latch Pins* into the locked (up) or unlocked (down) positions.
* **Sense** when the *Latch Pins* are in the locked or unlocked positions.

<figure>
<video playsinline autoplay controls muted loop><source src="/static/img/latch_video.webm"></video>
<figcaption>Unmute for a very annoying noise.</figcaption>
</figure>

On the left, a small electric motor
^[Probing with a voltmeter shows that when running, this motor is driven at around
3.2 Volts.]
turns a long shaft.  This causes the *Latch Pin Plate* (far right) to move up and
down, locking or unlocking the door.
At the same time it rotates the *Alignment Plate*
(center), which provides feedback so we can stop the motor at
just the right time.

Let's look at the latch and alignment mechanisms in more detail:

![](/static/img/motor_annotated.jpg)
![](/static/img/worm_annotated.jpg)

The operation of the latch is fairly simple.  The
[worm gear](https://en.wikipedia.org/wiki/Worm_drive)
on the drive shaft transforms the high-speed rotation of the motor into lower-speed
(but more powerful) motion of the *Latch Gear*.  The Latch Gear has an attached
[cam](https://en.wikipedia.org/wiki/Cam),
which turns the rotational movement of the gear into up/down movement of the Latch
Pin Plate.

The center section is a bit more complex.  Another worm gear turns the
*Alignment Gear*
^[Because the Latch Gear and Alignment Gear
have the same number of teeth, their rotations are exactly synchronized.]
which turns the Alignment Plate, 
a half-circle of plastic that rotates through the center of
the *Photo Interrupter*.  For half of its rotation it blocks the gap in the
Interrupter, and for the other half it leaves it unblocked.
The
[Photo Interrupter](https://www.rohm.com/electronics-basics/photointerrupters/what-is-a-photointerrupter)
is an optical device that senses when something
is blocking the gap.

If we watch the Alignment Plate and Latch Pin Plate moving as the controller
locks and unlocks the door, we can make some observations:

* The motor always turns in the same direction.  It doesn't rotate one way to lock
and the other way to unlock.
* This results in a continuous up, down, up, down motion of the Latch Pin Plate,
and continuous rotation of the Alignment Plate.
* The Latch Pins reach the fully-up (**locked**) position *just* as the Alignment Plate
**enters** the gap in the Photo Interrupter.  In other words, the door is locked just when the Interrupter
goes from unblocked to **blocked**.
* The Latch Pins reach the fully-down (**unlocked**) position *just* as the Alignment
Plate **exits** the gap in the Interrupter, so the door is fully
unlocked just when the Interrupter goes from
blocked to **unblocked**.

The Photo Interrupter is the most complex individual part here, with four wires
leading to it.  It was pretty obvious that its purpose is to sense the presence
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
(LED), which shines IR light across the gap when voltage is applied across pins
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

The relationship between HIGH, LOW, active, inactive, blocked, unblocked, locked
and unlocked gets a bit confusing.  Let's try to put all the pieces together:

* Just as the Latch Pins reach the **locked** position, the Alignment Plate *enters*
the gap of the Photo Interrupter.  This means the Interrupter is now *blocked*, so
light from the LED can *not* hit the Phototransistor.  This means that pin 3 and
pin 4 are disconnected, so pin 3 (the sense wire) is forced **HIGH** (5V) by a
pull-up resistor on the control board.  Since this is an active-LOW signal, we'd
say it is now **inactive**.
* Just as the Latch Pins reach the **unlocked** position, the Alignment Plate *exits*
the gap of the Interrupter, which is now *unblocked*, so light from the LED can
cross to the Phototransistor.  This allows it to conduct
electricity, creating a connection from pin 3 to pin 4.  Pin 4 is connected to 0V
(LOW), so pin 3 also goes **LOW**, and is now **active**.

Bottom line:  The sense wire (pin 3) means **UNLOCKED**.

Now finally we can summarize what it would take for the Raspberry Pi to control the
latch.  When we want to lock or unlock, turn on the LED and start the motor.  Wait
for pin 3 of the Phototransistor to change (HIGH to LOW, or LOW to HIGH,
depending on whether we're locking or unlocking the door).  Quickly turn off the
motor (and the LED).  Done!  The entire process takes around 0.3 seconds, so it's
important for the Pi to stop the motor very quickly after the voltage transition.

In terms of voltage compatibility, we need to drive the motor and LED, and we need
to sense the output of the Phototransistor.  The last one is easy --- we can use
the Pi's internal 3.3V pull-up resistors, just like with the reed switches.  The
motor appears to be driven at around 3.2V, which is close enough to the Pi's 3.3V
I/O level.
^[Though as we'll discuss in the next post, it may not be advisable to connect the
motor directly to an I/O pin.]

That just leaves the LED.  To connect to the Pi, we'll have to create our own LED
driver circuit with an appropriate current-limiting resistor.  This is standard
practice when driving LEDs from the Raspberry Pi, and we'll figure out the details
next time.

## Cutting the cord

Mission accomplished!  We
understand how to lock and unlock the door, and we know how to detect when the
cat is pushing on the door, and when it's in a wide-open position.
We understand the wiring well enough to create a
circuit diagram showing the purpose of all 12 wires:

<object data="/static/img/diagram-original.svg" width="80%" alt="Diagram" class="mx-auto" style="pointer-events: none;"></object>

We're ready to
dispense with the CatMate's built-in control board, and connect these signals to
the Raspberry Pi instead.  But that will mean physically cutting wires, which will
definitely break the catdoor!  Remember that we'd like to be able to restore the
door to its current working state, if the project doesn't work out.

What we'll do is splice pluggable connectors into the middle of the wires, so that
we can plug into either the control board, or the Pi.

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
we can wire the Raspberry Pi to another
connector, and swap from the CatMate's built-in controller to the Pi whenever we want.

Next time, we'll do exactly that!