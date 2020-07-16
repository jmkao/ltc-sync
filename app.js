const shell = require('shelljs');
const Timecode = require('smpte-timecode');
const yargs = require('yargs');
const { createWorker } = require('tesseract.js');
const ffmpeg = require('fluent-ffmpeg');

const argv = yargs.usage("Usage: $0 -i <input file name>")
  .option("i", { alias: "input",
	  describe: "Movie with LTC timecode audio and text timecode video",
	  type: "string",
	  demandOption: true
  })
  .option("n", { alias: "num_samples",
    describe: "Number of samples to analyze from movie",
    type: "number",
    default: 5
  })
  .argv;

const worker = createWorker();

const tmpdir = "WORKTMP";
const FPS = 30;

const inputFile = argv.i;
const samples = argv.n;

shell.rm('-rf', `${tmpdir}`);
shell.mkdir(`${tmpdir}`);

(async () => {
  await worker.load();
  await worker.loadLanguage('eng');
  await worker.initialize('eng');

  wavConvert(inputFile, `${tmpdir}/audio.wav`);  

  let tcTable = sampleLTCTable(ltcDumpTimecode(`${tmpdir}/audio.wav`), samples);
  await createScreenshots(inputFile, tmpdir, tcTable.map(e => e.end_sec));
  tcTable = await ocrScreenshotsToLTC(tcTable);

  printStats(tcTable);

  await worker.terminate();
})();

function printStats(tcTable) {

  let skipped = 0, sum = 0, count = 0, min = Number.POSITIVE_INFINITY, max = Number.NEGATIVE_INFINITY;

  for (s of tcTable) {
    if (!s.ocr_tc) {
      skipped++;
      continue;
    }

    let delayFrames = s.ltc_tc.frameCount - s.ocr_tc.frameCount;
    let delayMS = delayFrames * (1000/FPS);

    console.log(`${s.ltc_tc.toString()} - ${s.ocr_tc.toString()} = ${delayFrames} | ${delayMS}ms`)

    sum += delayMS;
    count++;
    if (delayMS > max) {
      max = delayMS;
    }

    if (delayMS < min) {
      min = delayMS;
    }
  }

  let avg = sum / count;

  console.log(`
    Samples used: ${count}
    Samples skipped: ${skipped}
    Min Delay Needed: ${min}
    Max Delay Needed: ${max}
    Average Delay Needed: ${avg}
  `);
}

function sampleLTCTable(ltcTable, samples) {
  const delta = Math.ceil(ltcTable.length / samples);
  let sampleTable = [];

  for (let i = 0; i < ltcTable.length; i+=delta) {
    sampleTable.push(ltcTable[i]);
  }

  // console.log(sampleTable);

  return sampleTable;
}

function ltcDumpTimecode(wavname) {
  let result = shell.exec(`ltcdump -a \"${wavname}\"`, {silent: true});

  let lines = result.stdout.split(/\r?\n/);
  let tcTable = [];
  for (const line of lines) {
    if (line.match(/\d\d:\d\d:\d\d:\d\d/)) {
      // We only want to process lines containing timecode
      let cols = line.split(/\s+/);
      if (cols.length == 3) {
        tcTable.push({
          start_sec: parseFloat(cols[0]),
          end_sec: parseFloat(cols[1]),
          ltc_tc: Timecode(cols[2], FPS, false)
        })
      }
    }
  }
  // console.log(tcTable);

  return tcTable;
}

function ltcDumpLastTimecode(wavname) {
  let tcTable = ltcDumpTimecode(wavname);

  let result = tcTable[tcTable.length - 1].ltc_tc;

  console.log(`Last LTC timecode of ${wavname} is ${result}`);

  return result;
}

function wavConvert(vidname, wavname) {
  let result = shell.exec(`ffmpeg -y -i \"${vidname}\" \"${wavname}\"`, {silent: true});

  return;
}

async function createScreenshots(vidname, outdir, tsArray) {
  return new Promise((resolve, reject) => {
    ffmpeg(vidname)
      .on('error', function (err) {
        console.log(`ffmpeg error processing ${vidname}: ${err.message}`);
        reject(err);
      })
      .on('end', function() {
        resolve(true);
      })
      .screenshots({
        timestamps: tsArray,
        filename: '%i.jpg',
        folder: outdir
      })
  });
}

async function ocrScreenshotsToLTC(tcTable) {
  for (let i=0; i<tcTable.length; i++) {
    let result = await getOCRTimecode(`${tmpdir}/${i+1}.jpg`);
    if (result) {
      tcTable[i].ocr_tc = result;
    }
  }
  return tcTable;
}

async function getOCRTimecode(imgname) {
  const { data: { text } } = await worker.recognize(imgname);

  console.log(`OCR timecode of ${imgname} is ${text.trim()}`);

  let tc = text.match(/\d+:\d+:\d+:\d+/);

  if (tc) {
    let result = false;
    try {
      result = Timecode(tc[0], FPS, false);
      return result;
    } catch (e) {
      return false;
    }
  } else {
    return false;
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
