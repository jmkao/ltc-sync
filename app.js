const shell = require('shelljs');
const Timecode = require('smpte-timecode');
const yargs = require('yargs');
const { createWorker } = require('tesseract.js');

const argv = yargs.usage("Usage: $0 -i <input file name>")
  .option("i", { alias: "input",
	  describe: "Movie with LTC timecode audio and text timecode video",
	  type: "string",
	  demandOption: true
  })
  .argv;

const worker = createWorker();

const tmpdir = "WORKTMP";
const FPS = 30;

const inputFile = argv.i;

shell.rm('-rf', `${tmpdir}`);
shell.mkdir(`${tmpdir}`);

(async () => {
  await worker.load();
  await worker.loadLanguage('eng');
  await worker.initialize('eng');

  wavConvert(inputFile, `${tmpdir}/audio.wav`);
  jpgLastFrame(inputFile, `${tmpdir}/last.jpg`);
  
  let audioTC = Timecode(ltcDumpLastTimecode(`${tmpdir}/audio.wav`, FPS, false));

  let videoTCString = await getOCRTimecode(`${tmpdir}/last.jpg`, FPS, false);
  let videoTC = Timecode(videoTCString);
  
  // console.log("Audio timecode in frames: "+audioTC.frameCount);
  // console.log("Video timecode in frames: "+videoTC.frameCount);
  
  let delayFrames = audioTC.frameCount - videoTC.frameCount;
  let delayMS = delayFrames * (1000/FPS);
  
  console.log(`Audio needs delay: ${delayFrames} frames, ${delayMS}ms`);  

  await worker.terminate();
})();


function ltcDumpLastTimecode(wavname) {
  let result = shell.exec(`ltcdump \"${wavname}\"`, {silent: true})
    .grep(/\d\d:\d\d:\d\d:\d\d/)
    .sed(/.*(\d\d:\d\d:\d\d:\d\d).*/, '$1')
    .tail({'-n': 1})
    .stdout.trim();

  console.log(`Last LTC timecode of ${wavname} is ${result}`);

  return result;
}

function jpgLastFrame(vidname, outname) {
  let result = shell.exec(`ffmpeg -y -sseof -3 -i \"${vidname}\" -update 1 -q:v 1 \"${outname}\"`, {silent: true});

  return;
}

function wavConvert(vidname, wavname) {
  let result = shell.exec(`ffmpeg -y -i \"${vidname}\" \"${wavname}\"`, {silent: true});

  return;
}

async function getOCRTimecode(imgname) {
  const { data: { text } } = await worker.recognize(imgname);

  console.log(`OCR timecode of ${imgname} is ${text}`);

  let tc = text.match(/\d\d:\d\d:\d\d:\d\d/);

  if (tc) {
    return tc[0];
  } else {
    return 'XX:XX:XX:XX';
  }
}

function getOCRTimecodeExternal(imgname) {
  let result = shell.exec(`tesseract \"${imgname}\" stdout`, {silent: true})
    .grep(/\d\d:\d\d:\d\d:\d\d/)
    .sed(/.*(\d\d:\d\d:\d\d:\d\d).*/, '$1')
    .stdout.trim();
  
  console.log(`OCR timecode of ${imgname} is ${result}`);

  return result;
}
