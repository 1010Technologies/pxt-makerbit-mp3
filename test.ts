/**
 * Serial MP3 tests
 */

makerbit.connectSerialMp3(DigitalPin.P0, DigitalPin.P1);

makerbit.playMp3Track(1, 1);
makerbit.playMp3TrackFromFolder(1, 1, Mp3Repeat.No);
makerbit.playMp3TrackFromFolder(1, 1, Mp3Repeat.Forever);
makerbit.playMp3Folder(1, Mp3Repeat.No);
makerbit.playMp3Folder(1, Mp3Repeat.Forever);
makerbit.setMp3Volume(30);

makerbit.runMp3Command(Mp3Command.PLAY_NEXT_TRACK);
makerbit.runMp3Command(Mp3Command.PLAY_PREVIOUS_TRACK);
makerbit.runMp3Command(Mp3Command.INCREASE_VOLUME);
makerbit.runMp3Command(Mp3Command.DECREASE_VOLUME);
makerbit.runMp3Command(Mp3Command.PAUSE);
makerbit.runMp3Command(Mp3Command.RESUME);
makerbit.runMp3Command(Mp3Command.STOP);
makerbit.runMp3Command(Mp3Command.MUTE);
makerbit.runMp3Command(Mp3Command.UNMUTE);

makerbit.onMp3TrackStarted(() => {});
makerbit.onMp3TrackCompleted(() => {});
const folder: number = makerbit.mp3Folder();
const track: number = makerbit.mp3Track();
const volume: number = makerbit.mp3Volume();
