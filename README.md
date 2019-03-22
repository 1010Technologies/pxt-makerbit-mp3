# MakerBit MP3

[![Build Status](https://travis-ci.org/1010Technologies/pxt-makerbit-mp3.svg?branch=master)](https://travis-ci.org/1010Technologies/pxt-makerbit-mp3)

MakeCode extension for Serial MP3 players with the YX5300 chip.

## MakerBit Board

The MakerBit connects to the BBC micro:bit to provide easy connections to a wide variety of sensors, actuators and other components, for example a Serial MP3 player.

http://makerbit.com/

| ![MakerBit](https://github.com/1010Technologies/pxt-makerbit/raw/master/MakerBit.png "MakerBit") | ![MakerBit+R](https://github.com/1010Technologies/pxt-makerbit/raw/master/MakerBit+R.png "MakerBit+R") |
| :----------------------------------------------------------------------------------------------: | :----------------------------------------------------------------------------------------------------: |
|                                            _MakerBit_                                            |                                   _MakerBit+R with motor controller_                                   |

## Serial MP3

This extension supports MP3 devices with the YX5300 chip, e.g. the Catalex Serial MP3.

The microSD card shall be formatted as FAT16 or FAT32. exFAT is not supported properly and shall be avoided.

To support all commands properly, the names of folders and files need to obey the following strict pattern:

- Directory names are two-digit numbers, e.g. `01`.
- Track names within the directories shall start with a three digit numbers such as `001.mp3` or `002.wav`

Up to 99 directories and 255 tracks per directory are supported.

```
├── 01/
│   ├── 001.mp3
│   ├── 002 second track.mp3
│   └── 003 third track.mp3
├── 02/
│   ├── 001.mp3
│   └── 002.mp3
│
…
```

The MP3 device reads files and folders in alphabetic order. It is required to create a sequence of folders like `01`, `02`, `03` and name the tracks within each folder starting at `001`. Make sure to avoid gaps in your number based naming scheme. This allows you to use folder and track names as parameters in the playback functions below.

If you experience playback problems, check for deviations to the naming convention and the file system format.

### MakerBit connectSerialMp3

Connects to the Serial MP3 device. The first pin needs to be attached the MP3 device receiver pin (RX) and the second pin to the MP3 device transmitter pin (TX).

```sig
makerbit.connectSerialMp3(DigitalPin.P0, DigitalPin.P1)
```

### MakerBit playMp3TrackFromFolder

Plays a track from a folder.

```sig
makerbit.playMp3TrackFromFolder(1, 1, Mp3Repeat.No)
```

### MakerBit playMp3Folder

Plays all tracks in a folder.

```sig
makerbit.playMp3Folder(1, Mp3Repeat.No)
```

### MakerBit setMp3Volume

Sets the volume.

```sig
makerbit.setMp3Volume(30)
```

### MakerBit runMp3Command

Dispatches a command to the MP3 device.

```sig
makerbit.runMp3Command(Mp3Command.PLAY_NEXT_TRACK)
```

### MakerBit onMp3TrackStarted

Do something when a MP3 track is started.

```sig
makerbit.onMp3TrackStarted(() => {})
```

### MakerBit onMp3TrackCompleted

Do something when a MP3 track is completed.

```sig
makerbit.onMp3TrackCompleted(() => {})
```

### MakerBit mp3Folder

Returns the index of the selected MP3 folder.

```sig
makerbit.mp3Folder()
```

### MakerBit mp3Track

Returns the index of the last MP3 track event.

```sig
makerbit.mp3Track()
```

### MakerBit mp3Volume

Returns the MP3 volume.

```sig
makerbit.mp3Volume()
```

## License

Licensed under the MIT License (MIT). See LICENSE file for more details.

## Supported targets

- for PXT/microbit
