# Controller Emulator (TUI)
**Tech:** Python, Textual, vgamepad, evdev

Designed a terminal-based (Textual) application that maps keyboard input
to a virtual gamepad, supporting Xbox, DualShock, and Wii profiles
with a modal keybind editor.

Implemented profile persistence (profiles.json) and cross-platform
support (Windows via vgamepad, Linux via uinput/evdev).
