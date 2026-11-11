---
version: alpha
name: CHOWK
description: A night-time traffic simulation and evaluation tool centred on a live oblique view of an authored Indian arterial.
colors:
  background: "#05070D"
  surface: "#0A0F1A"
  text: "#E8EDF5"
  muted: "#8A94A6"
  border: "#202A36"
  accent: "#3DF2B4"
  asphalt: "#12161F"
  window: "#FFC27A"
  lamp: "#FFB057"
  signalGreen: "#2BE38B"
  signalAmber: "#FFB020"
  signalRed: "#FF4D4D"
typography:
  sans:
    fontFamily: "Inter Variable, Inter, Segoe UI, sans-serif"
  mono:
    fontFamily: "ui-monospace, Cascadia Code, SFMono-Regular, monospace"
rounded:
  DEFAULT: "6px"
  lg: "12px"
spacing:
  page-max: "1540px"
components:
  button: {}
  select: {}
  viewport: {}
---

# CHOWK Design System

## Overview

CHOWK should feel like looking down on an Indian arterial from a building at night. Dark roofs set the scale. Amber street lamps trace the road. Headlights, tail-lights and signal changes show how it moves. The signature is the continuous, oblique corridor seen through the instrument viewport.

The primary audience is a hackathon judge working at a desktop or laptop, followed by visitors exploring the simulation. The interface is in English. Indian context comes from the arterial geometry and the traffic mix. The Live view is a simulation instrument. Results, Method and Limits share its navigation and visual language.

[Rendering art direction](plan/05-rendering.md) owns the base palette. The UI values above map to the CSS variables in [the application stylesheet](apps/web/src/styles.css). Scene materials adapt the palette to linear lighting and ACES filmic tone mapping.

## Colors

Night blue provides the background and surface hierarchy. Mint indicates focus, navigation selection, active camera controls and a running simulation. Amber indicates the corridor is still initialising. Signal colors belong to traffic states, with visible lamp positions and the state-driven rendering used to distinguish them.

## Typography

Inter is served with the application. Use compact, medium-weight controls and a clear heading hierarchy. Use mono for playback rates, station labels and technical status. Use tabular numerals when rendering changing measurements.

## Layout

Centre the shell on desktop. The navigation sits above the full-width scene. Keep scene controls in a continuous footer rail with playback at the left and camera stations in the middle. Keep longer Method and Limits prose in a narrower reading column. The application stylesheet owns the scrollbar baseline.

## Elevation & Depth

Separate panels with one-pixel borders and small changes in background tone. Reserve glow for light sources in the scene, selected station markers and current focus. Scene annotations sit on the same overlay layer.

## Shapes

Use 6 px corners on controls and 12 px on the instrument. The round station markers represent junction positions along the arterial. Keep controls out of the main scene composition.

## Components

Native buttons handle actions. Links handle navigation and expose the current route. The render-quality control and Results scenario control use labelled native selects with platform-owned popup geometry. Hover and focus states are visible. Scene controls remain unavailable while graphics initialise, and the viewport reserves its height for loading and recovery. Results uses the same panel tokens and monospace provenance, with interval whiskers and data tables for the simulation measurements.

The viewport uses a thin progress line during scene setup. If graphics fail, the viewport shows the reason and offers reload when available. Information pages keep their headings and navigation in pending states.

Icons use a simple line style. Icon-only controls carry an accessible label. Camera moves are damped and can be interrupted with the mouse. Reduced-motion mode starts with preview playback paused and cuts between camera presets.

## Do's and Don'ts

- Put the road network and its motion at the centre of the Live view.
- Name the controller and label live measurements as simulation results.
- Present benchmark numbers only from the results pipeline.
- Keep vehicle and signal lighting legible against the city.
