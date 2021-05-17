// MakerBit Serial MP3 blocks supporting Catalex Serial MP3 1.0

const enum Mp3Repeat {
  //% block="once"
  No = 0,
  //% block="forever"
  Forever = 1,
}

const enum Mp3Command {
  //% block="play next track"
  PLAY_NEXT_TRACK,
  //% block="play previous track"
  PLAY_PREVIOUS_TRACK,
  //% block="increase volume"
  INCREASE_VOLUME,
  //% block="decrease volume"
  DECREASE_VOLUME,
  //% block="pause"
  PAUSE,
  //% block="resume"
  RESUME,
  //% block="stop"
  STOP,
  //% block="mute"
  MUTE,
  //% block="unmute"
  UNMUTE,
}

//% color=#0fbc11 icon="\u272a" block="MakerBit"
//% category="MakerBit"
namespace makerbit {
  const enum PlayMode {
    Track = 0,
    Folder = 1,
  }

  interface DeviceState {
    track: uint16;
    folder: uint8;
    playMode: PlayMode;
    repeat: Mp3Repeat;
    maxTracksInFolder: uint8;
    volume: uint8;
    previousTrackCompletedResponse: int16;
    lastTrackEventValue: uint16;
    isPlaying: boolean;
    nextCommand: number;
  }

  let deviceState: DeviceState = undefined;

  const MICROBIT_MAKERBIT_MP3_TRACK_STARTED_ID = 756;
  const MICROBIT_MAKERBIT_MP3_TRACK_COMPLETED_ID = 757;

  function readUntilResponseStart(): void {
    let startFound = false;
    while (true) {
      while (serial.available() > 0) {
        const c = serial.read();
        if (c == YX5300.ResponseType.RESPONSE_START_BYTE) {
          startFound = true;
        } else if (startFound && c == YX5300.ResponseType.RESPONSE_VER_BYTE) {
          return;
        } else {
          startFound = false;
        }
      }
      basic.pause(200);
    }
  }

  function readSerial() {
    serial.setRxBufferSize(32)

    const buffer: Buffer = pins.createBuffer(10);

    buffer.setNumber(
      NumberFormat.UInt8LE,
      0,
      YX5300.ResponseType.RESPONSE_START_BYTE
    );
    buffer.setNumber(
      NumberFormat.UInt8LE,
      1,
      YX5300.ResponseType.RESPONSE_VER_BYTE
    );

    while (true) {
      readUntilResponseStart();

      let bufferIndex = 2;
      while (serial.available() > 0 && bufferIndex < 10) {
        const c = serial.read();
        buffer.setNumber(NumberFormat.UInt8LE, bufferIndex, c);
        bufferIndex++;
      }

      const response = YX5300.decodeResponse(buffer);
      handleResponse(response);
    }
  }

  function handleResponse(response: YX5300.Response) {
    switch (response.type) {
      case YX5300.ResponseType.TRACK_NOT_FOUND:
        handleResponseTrackNotFound(response);
        break;
      case YX5300.ResponseType.TRACK_COMPLETED:
        handleResponseTrackCompleted(response);
        break;
      case YX5300.ResponseType.PLAYBACK_STATUS:
        handleResponseStatus(response);
        break;
      default:
        break;
    }
  }

  function handleResponseStatus(response: YX5300.Response) {
    if (!deviceState) {
      return;
    }

    // The data high bytes contains the file store (TF is 2).
    // The data low byte contains the playback status: stopped=0, playing=1, paused=2.
    deviceState.isPlaying = (response.payload & 0xFF) == 1;
  }

  function handleResponseTrackNotFound(response: YX5300.Response) {
    if (!deviceState) {
      return;
    }

    deviceState.isPlaying = false;

    if (deviceState.track < deviceState.maxTracksInFolder) {
      deviceState.maxTracksInFolder = deviceState.track;
    }

    if (
      deviceState.track > 1 &&
      deviceState.playMode === PlayMode.Folder &&
      deviceState.repeat === Mp3Repeat.Forever
    ) {
      deviceState.track = 1;
      playTrackOnDevice(deviceState);
    }
  }

  function handleResponseTrackCompleted(response: YX5300.Response) {
    if (!deviceState) {
      return;
    }

    // At end of playback we receive up to two TRACK_COMPLETED events.
    // We use the 1st TRACK_COMPLETED event to notify playback as complete
    // or to advance folder play. A following 2nd event with same playload is ignored.
    if (deviceState.previousTrackCompletedResponse !== response.payload) {
      control.raiseEvent(
        MICROBIT_MAKERBIT_MP3_TRACK_COMPLETED_ID,
        deviceState.track
      );
      deviceState.lastTrackEventValue = deviceState.track;
      deviceState.isPlaying = false;
      if (deviceState.playMode === PlayMode.Folder) {
        deviceState.track++;
        playTrackOnDevice(deviceState);
      }

      deviceState.previousTrackCompletedResponse = response.payload;
    }
  }

  /**
   * Connects to the Serial MP3 device.
   * @param mp3RX MP3 device receiver pin (RX), eg: DigitalPin.P0
   * @param mp3TX MP3 device transmitter pin (TX), eg: DigitalPin.P1
   */
  //% subcategory="MP3"
  //% blockId="makerbit_mp3_connect" block="connect MP3 device with MP3 RX attached to %mp3RX | and MP3 TX to %mp3TX"
  //% mp3RX.fieldEditor="gridpicker" mp3RX.fieldOptions.columns=3
  //% mp3RX.fieldOptions.tooltips="false"
  //% mp3TX.fieldEditor="gridpicker" mp3TX.fieldOptions.columns=3
  //% mp3TX.fieldOptions.tooltips="false"
  //% weight=50
  export function connectSerialMp3(mp3RX: DigitalPin, mp3TX: DigitalPin): void {
    serial.redirect(mp3RX as number, mp3TX as number, BaudRate.BaudRate9600);

    if (!deviceState) {
      control.inBackground(readSerial);
    }

    deviceState = {
      track: 1,
      folder: 1,
      playMode: PlayMode.Track,
      repeat: Mp3Repeat.No,
      maxTracksInFolder: YX5300.MAX_TRACKS_PER_FOLDER,
      volume: 30,
      previousTrackCompletedResponse: -1,
      lastTrackEventValue: 0,
      isPlaying: false,
      nextCommand: 0
    };

    sendCommand(YX5300.selectDeviceTfCard());
    basic.pause(500);
    sendCommand(YX5300.stop());
    sendCommand(YX5300.queryStatus());
    sendCommand(YX5300.unmute());
    setMp3Volume(30);
    basic.pause(500);
  }

  /**
   * Plays a track from a folder and waits for completion.
   * @param track track index, eg:1
   * @param folder folder index, eg:1
   */
  //% subcategory="MP3"
  //% blockId="makerbit_mp3_play_track" block="play MP3 track %track | from folder %folder and wait for completion"
  //% track.min=1 track.max=255
  //% folder.min=1 folder.max=99
  //% weight=49
  export function playMp3Track(track: number, folder: number): void {
    if (!deviceState) {
      connectSerialMp3(DigitalPin.P0, DigitalPin.P1);
    }

    playMp3TrackFromFolder(track, folder, Mp3Repeat.No);
    while (deviceState.isPlaying) {
      basic.pause(500);
      sendCommand(YX5300.queryStatus());
    }
  }

  /**
   * Plays a track from a folder.
   * @param track track index, eg:1
   * @param folder folder index, eg:1
   * @param repeat indicates whether to repeat the track, eg: Mp3Repeat.No
   */
  //% subcategory="MP3"
  //% blockId="makerbit_mp3_play_track_from_folder" block="play MP3 track %track | from folder %folder | %repeat"
  //% track.min=1 track.max=255
  //% folder.min=1 folder.max=99
  //% weight=48
  export function playMp3TrackFromFolder(
    track: number,
    folder: number,
    repeat: Mp3Repeat
  ): void {
    if (!deviceState) {
      connectSerialMp3(DigitalPin.P0, DigitalPin.P1);
    }

    deviceState.track = Math.min(
      Math.max(track, 1),
      YX5300.MAX_TRACKS_PER_FOLDER
    );
    deviceState.folder = Math.min(Math.max(folder, 1), 99);
    deviceState.playMode = PlayMode.Track;
    deviceState.repeat = repeat;
    deviceState.maxTracksInFolder = YX5300.MAX_TRACKS_PER_FOLDER;
    playTrackOnDevice(deviceState);
  }

  /**
   * Plays all tracks in a folder.
   * @param folder folder index, eg:1
   * @param repeat indicates whether to repeat the folder, eg: Mp3Repeat.No
   */
  //% subcategory="MP3"
  //% blockId="makerbit_mp3_play_folder" block="play MP3 folder %folder | %repeat"
  //% folder.min=1 folder.max=99
  //% weight=47
  export function playMp3Folder(folder: number, repeat: Mp3Repeat): void {
    if (!deviceState) {
      connectSerialMp3(DigitalPin.P0, DigitalPin.P1);
    }

    deviceState.track = 1;
    deviceState.folder = folder;
    deviceState.playMode = PlayMode.Folder;
    deviceState.repeat = repeat;
    deviceState.maxTracksInFolder = YX5300.MAX_TRACKS_PER_FOLDER;
    playTrackOnDevice(deviceState);
  }

  function playTrackOnDevice(targetState: DeviceState): void {
    deviceState.previousTrackCompletedResponse = -1;
    deviceState.isPlaying = true;

    sendCommand(
      YX5300.playTrackFromFolder(targetState.track, targetState.folder)
    );

    if (
      targetState.playMode === PlayMode.Track &&
      targetState.repeat === Mp3Repeat.Forever
    ) {
      sendCommand(YX5300.enableRepeatModeForCurrentTrack());
    }

    control.raiseEvent(
      MICROBIT_MAKERBIT_MP3_TRACK_STARTED_ID,
      deviceState.track
    );

    deviceState.lastTrackEventValue = deviceState.track;
  }

  /**
   * Sets the volume.
   * @param volume volume in the range of 0 to 30: eg: 30
   */
  //% subcategory="MP3"
  //% blockId="makerbit_mp3_set_volume" block="set MP3 volume to %volume"
  //% volume.min=0 volume.max=30
  //% weight=46
  export function setMp3Volume(volume: number): void {
    if (!deviceState) {
      connectSerialMp3(DigitalPin.P0, DigitalPin.P1);
    }

    if (volume < 0 || volume > 30) {
      return;
    }
    deviceState.volume = volume;
    sendCommand(YX5300.setVolume(volume));
  }

  /**
   * Dispatches a command to the MP3 device.
   * @param command command, eg: Mp3Command.PLAY_NEXT_TRACK
   */
  //% subcategory="MP3"
  //% blockId="makerbit_mp3_run_command"
  //% block="MP3 %command"
  //% weight=45
  export function runMp3Command(command: Mp3Command): void {
    if (!deviceState) {
      connectSerialMp3(DigitalPin.P0, DigitalPin.P1);
    }

    switch (command) {
      case Mp3Command.PLAY_NEXT_TRACK:
        if (deviceState.track < deviceState.maxTracksInFolder) {
          deviceState.track += 1;
          if (deviceState.playMode === PlayMode.Track) {
            deviceState.repeat = Mp3Repeat.No;
          }
          playTrackOnDevice(deviceState);
        }
        break;
      case Mp3Command.PLAY_PREVIOUS_TRACK:
        if (deviceState.track > 1) {
          deviceState.track -= 1;
        }
        if (deviceState.playMode === PlayMode.Track) {
          deviceState.repeat = Mp3Repeat.No;
        }
        playTrackOnDevice(deviceState);
        break;
      case Mp3Command.INCREASE_VOLUME:
        setMp3Volume(deviceState.volume + 1);
        break;
      case Mp3Command.DECREASE_VOLUME:
        setMp3Volume(deviceState.volume - 1);
        break;
      case Mp3Command.PAUSE:
        sendCommand(YX5300.pause());
        break;
      case Mp3Command.RESUME:
        sendCommand(YX5300.resume());
        break;
      case Mp3Command.STOP:
        deviceState.isPlaying = false;
        sendCommand(YX5300.stop());
        break;
      case Mp3Command.MUTE:
        sendCommand(YX5300.mute());
        break;
      case Mp3Command.UNMUTE:
        sendCommand(YX5300.unmute());
        break;
    }
  }

  function sendCommand(command: Buffer): void {
    const now = control.millis();
    if (deviceState.nextCommand > now) {
      basic.pause(deviceState.nextCommand - now);
    }
    deviceState.nextCommand = now + YX5300.REQUIRED_PAUSE_BETWEEN_COMMANDS_MILLIS;
    serial.writeBufferBlocking(command);
  }

  /**
   * Do something when a MP3 track is started.
   * @param handler body code to run when event is raised
   */
  //% subcategory="MP3"
  //% blockId=makerbit_mp3_on_track_started
  //% block="on MP3 track started"
  //% weight=42
  export function onMp3TrackStarted(handler: () => void) {
    control.onEvent(
      MICROBIT_MAKERBIT_MP3_TRACK_STARTED_ID,
      EventBusValue.MICROBIT_EVT_ANY,
      () => {
        const value = control.eventValue();
        basic.pause(10); // defer call so that the 2nd track completion event can be processed before
        deviceState.lastTrackEventValue = value;
        handler();
      }
    );
  }

  /**
   * Do something when a MP3 track is completed.
   * @param handler body code to run when event is raised
   */
  //% subcategory="MP3"
  //% blockId=makerbit_mp3_on_track_completed
  //% block="on MP3 track completed"
  //% weight=41
  export function onMp3TrackCompleted(handler: () => void) {
    control.onEvent(
      MICROBIT_MAKERBIT_MP3_TRACK_COMPLETED_ID,
      EventBusValue.MICROBIT_EVT_ANY,
      () => {
        const value = control.eventValue();
        basic.pause(10); // defer call so that the 2nd track completion event can be processed before
        deviceState.lastTrackEventValue = value;
        handler();
      }
    );
  }

  /**
   * Returns the index of the selected MP3 folder.
   */
  //% subcategory="MP3"
  //% blockId="makerbit_mp3_folder"
  //% block="MP3 folder"
  //% weight=40
  export function mp3Folder(): number {
    return deviceState ? deviceState.folder : 1;
  }

  /**
   * Returns the index of the last MP3 track event.
   * It could be either a track started or completed event.
   * This block intended to be used inside of track event handlers.
   */
  //% subcategory="MP3"
  //% blockId="makerbit_mp3_track"
  //% block="MP3 track"
  //% weight=39
  export function mp3Track(): number {
    return deviceState ? deviceState.lastTrackEventValue : 1;
  }

  /**
   * Returns the MP3 volume.
   */
  //% subcategory="MP3"
  //% blockId="makerbit_mp3_volume"
  //% block="MP3 volume"
  //% weight=38
  export function mp3Volume(): number {
    return deviceState ? deviceState.volume : 30;
  }

  // YX5300 asynchronous serial port control commands
  export namespace YX5300 {
    export interface Response {
      type: ResponseType;
      payload?: number;
    }

    export const REQUIRED_PAUSE_BETWEEN_COMMANDS_MILLIS = 300;
    export const MAX_TRACKS_PER_FOLDER = 255;

    export const enum CommandCode {
      PLAY_NEXT_TRACK = 0x01,
      PLAY_PREV_TRACK = 0x02,
      PLAY_TRACK = 0x03,
      INCREASE_VOLUME = 0x04,
      DECREASE_VOLUME = 0x05,
      SET_VOLUME = 0x06,
      REPEAT_TRACK = 0x08,
      SELECT_DEVICE = 0x09,
      RESET = 0x0c,
      RESUME = 0x0d,
      PAUSE = 0x0e,
      PLAY_TRACK_FROM_FOLDER = 0x0f,
      STOP = 0x16,
      REPEAT_FOLDER = 0x17,
      PLAY_RANDOM = 0x18,
      REPEAT_CURRENT_TRACK = 0x19,
      MUTE = 0x1a,
      QUERY_STATUS = 0x42,
      QUERY_VOLUME = 0x43,
      QUERY_TOTAL_TRACK_COUNT = 0x48,
      QUERY_TRACK = 0x4c,
      QUERY_FOLDER_TRACK_COUNT = 0x4e,
      QUERY_FOLDER_COUNT = 0x4f,
    }

    export const enum ResponseType {
      RESPONSE_INVALID = 0x00,
      RESPONSE_START_BYTE = 0x7e,
      RESPONSE_VER_BYTE = 0xff,
      RESPONSE_ENDING_BYTE = 0xef,
      TF_CARD_INSERT = 0x3a,
      TRACK_COMPLETED = 0x3d,
      TRACK_NOT_FOUND = 0x40,
      ACK = 0x41,
      PLAYBACK_STATUS = 0x42,
      VOLUME = 0x43,
      CURRENT_TRACK = 0x4c,
      FOLDER_TRACK_COUNT = 0x4e,
      FOLDER_COUNT = 0x4f,
    }

    let commandBuffer: Buffer = undefined;

    export function composeSerialCommand(
      command: CommandCode,
      dataHigh: number,
      dataLow: number
    ): Buffer {
      if (!commandBuffer) {
        commandBuffer = pins.createBuffer(8);
        commandBuffer.setNumber(NumberFormat.UInt8LE, 0, 0x7e);
        commandBuffer.setNumber(NumberFormat.UInt8LE, 1, 0xff);
        commandBuffer.setNumber(NumberFormat.UInt8LE, 2, 0x06);
        commandBuffer.setNumber(NumberFormat.UInt8LE, 4, 0x00);
        commandBuffer.setNumber(NumberFormat.UInt8LE, 7, 0xef);
      }
      commandBuffer.setNumber(NumberFormat.UInt8LE, 3, command);
      commandBuffer.setNumber(NumberFormat.UInt8LE, 5, dataHigh);
      commandBuffer.setNumber(NumberFormat.UInt8LE, 6, dataLow);
      return commandBuffer;
    }

    export function next(): Buffer {
      return composeSerialCommand(CommandCode.PLAY_NEXT_TRACK, 0x00, 0x00);
    }

    export function previous(): Buffer {
      return composeSerialCommand(CommandCode.PLAY_PREV_TRACK, 0x00, 0x00);
    }

    export function playTrack(track: number): Buffer {
      return composeSerialCommand(CommandCode.PLAY_TRACK, 0x00, track);
    }

    export function increaseVolume(): Buffer {
      return composeSerialCommand(CommandCode.INCREASE_VOLUME, 0x00, 0x00);
    }

    export function decreaseVolume(): Buffer {
      return composeSerialCommand(CommandCode.DECREASE_VOLUME, 0x00, 0x00);
    }

    export function setVolume(volume: number): Buffer {
      const clippedVolume = Math.min(Math.max(volume, 0), 30);
      return composeSerialCommand(CommandCode.SET_VOLUME, 0x00, clippedVolume);
    }

    export function repeatTrack(track: number): Buffer {
      return composeSerialCommand(CommandCode.REPEAT_TRACK, 0x00, track);
    }

    export function selectDeviceTfCard(): Buffer {
      return composeSerialCommand(CommandCode.SELECT_DEVICE, 0x00, 0x02);
    }

    export function resume(): Buffer {
      return composeSerialCommand(CommandCode.RESUME, 0x00, 0x00);
    }

    export function pause(): Buffer {
      return composeSerialCommand(CommandCode.PAUSE, 0x00, 0x00);
    }

    export function playTrackFromFolder(track: number, folder: number): Buffer {
      return composeSerialCommand(
        CommandCode.PLAY_TRACK_FROM_FOLDER,
        folder,
        track
      );
    }

    export function queryStatus(): Buffer {
      return composeSerialCommand(CommandCode.QUERY_STATUS, 0x00, 0x00);
    }

    export function queryVolume(): Buffer {
      return composeSerialCommand(CommandCode.QUERY_VOLUME, 0x00, 0x00);
    }

    export function queryTrack(): Buffer {
      return composeSerialCommand(CommandCode.QUERY_TRACK, 0x00, 0x00);
    }

    export function queryFolderTrackCount(folder: number): Buffer {
      return composeSerialCommand(
        CommandCode.QUERY_FOLDER_TRACK_COUNT,
        0x00,
        folder
      );
    }

    export function queryFolderCount(): Buffer {
      return composeSerialCommand(CommandCode.QUERY_FOLDER_COUNT, 0x00, 0x00);
    }

    export function stop(): Buffer {
      return composeSerialCommand(CommandCode.STOP, 0x00, 0x00);
    }

    export function repeatFolder(folder: number): Buffer {
      return composeSerialCommand(CommandCode.REPEAT_FOLDER, folder, 0x02);
    }

    export function playRandom(): Buffer {
      return composeSerialCommand(CommandCode.PLAY_RANDOM, 0x00, 0x00);
    }

    export function enableRepeatModeForCurrentTrack(): Buffer {
      return composeSerialCommand(CommandCode.REPEAT_CURRENT_TRACK, 0x00, 0x00);
    }

    export function disableRepeatMode(): Buffer {
      return composeSerialCommand(CommandCode.REPEAT_CURRENT_TRACK, 0x00, 0x01);
    }

    export function mute(): Buffer {
      return composeSerialCommand(CommandCode.MUTE, 0x00, 0x01);
    }

    export function unmute(): Buffer {
      return composeSerialCommand(CommandCode.MUTE, 0x00, 0x00);
    }

    export function decodeResponse(response: Buffer): Response {
      if (response.length != 10) {
        return { type: ResponseType.RESPONSE_INVALID };
      }

      if (
        response.getNumber(NumberFormat.UInt8LE, 0) !=
        ResponseType.RESPONSE_START_BYTE
      ) {
        return { type: ResponseType.RESPONSE_INVALID };
      }

      if (
        response.getNumber(NumberFormat.UInt8LE, 1) !=
        ResponseType.RESPONSE_VER_BYTE
      ) {
        return { type: ResponseType.RESPONSE_INVALID };
      }

      if (
        response.getNumber(NumberFormat.UInt8LE, 9) !=
        ResponseType.RESPONSE_ENDING_BYTE
      ) {
        return { type: ResponseType.RESPONSE_INVALID };
      }

      const type = response.getNumber(NumberFormat.UInt8LE, 3);
      const payload =
        (response.getNumber(NumberFormat.UInt8LE, 5) << 8) |
        response.getNumber(NumberFormat.UInt8LE, 6);

      return { type: type, payload: payload };
    }
  }
}
