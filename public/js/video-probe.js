/*
 * Client-side video measurement.
 *
 * The file never leaves the browser: it is decoded by a <video> element, sampled
 * onto a small canvas, and reduced to a handful of numbers (duration, frame
 * size, and the timestamps where the picture changes enough to count as a cut).
 * Only those numbers are sent to the API.
 */
(function (global) {
  'use strict';

  var SAMPLE_WIDTH = 48;
  var SAMPLE_HEIGHT = 84;
  var MAX_SAMPLES = 90;
  var CUT_THRESHOLD = 0.14; // Mean absolute luma difference, normalised 0-1.

  function loadMetadata(video, url) {
    return new Promise(function (resolve, reject) {
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.src = url;
      video.onloadedmetadata = function () {
        resolve();
      };
      video.onerror = function () {
        reject(new Error('تعذّر قراءة ملف الفيديو. جرّب صيغة MP4 أو MOV.'));
      };
    });
  }

  function seek(video, time) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (!done) {
          done = true;
          resolve(false); // Some codecs refuse a seek; skip that sample.
        }
      }, 2500);
      video.onseeked = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(true);
      };
      video.onerror = function () {
        clearTimeout(timer);
        reject(new Error('تعذّر قراءة أحد مشاهد الفيديو.'));
      };
      try {
        video.currentTime = time;
      } catch {
        clearTimeout(timer);
        resolve(false);
      }
    });
  }

  function lumaFrame(ctx) {
    var data = ctx.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT).data;
    var out = new Float32Array(SAMPLE_WIDTH * SAMPLE_HEIGHT);
    for (var i = 0, p = 0; i < data.length; i += 4, p += 1) {
      out[p] = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
    }
    return out;
  }

  function meanDiff(a, b) {
    var total = 0;
    for (var i = 0; i < a.length; i += 1) total += Math.abs(a[i] - b[i]);
    return total / a.length;
  }

  /**
   * @param {File} file
   * @param {(ratio:number)=>void} [onProgress]
   * @returns {Promise<{durationSeconds:number,width:number,height:number,sizeBytes:number,cuts:number[],url:string,sampled:boolean}>}
   */
  function probeVideo(file, onProgress) {
    var url = URL.createObjectURL(file);
    var video = document.createElement('video');
    var canvas = document.createElement('canvas');
    canvas.width = SAMPLE_WIDTH;
    canvas.height = SAMPLE_HEIGHT;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });

    return loadMetadata(video, url).then(function () {
      var duration = Number(video.duration);
      var base = {
        durationSeconds: Number.isFinite(duration) ? duration : 0,
        width: video.videoWidth || null,
        height: video.videoHeight || null,
        sizeBytes: file.size,
        fileName: file.name,
        cuts: [],
        url: url,
        sampled: false,
      };

      if (!Number.isFinite(duration) || duration <= 0 || !ctx) return base;

      var sampleCount = Math.max(8, Math.min(MAX_SAMPLES, Math.round(duration * 4)));
      var step = duration / sampleCount;
      var previous = null;
      var cuts = [];
      var index = 0;

      function next() {
        if (index >= sampleCount) {
          base.cuts = cuts;
          base.sampled = true;
          return base;
        }
        var time = Math.min(duration - 0.05, index * step);
        return seek(video, time).then(function (ok) {
          if (ok) {
            ctx.drawImage(video, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
            var frame = lumaFrame(ctx);
            if (previous && meanDiff(previous, frame) > CUT_THRESHOLD) cuts.push(Number(time.toFixed(2)));
            previous = frame;
          }
          index += 1;
          if (onProgress) onProgress(index / sampleCount);
          return next();
        });
      }

      return next();
    });
  }

  global.probeVideo = probeVideo;
})(window);
