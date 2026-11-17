/* Chuka Comrades: background "scan a paper" job runner.
   One plain script, loaded by the service worker (importScripts) AND by the page.
   A job lives in IndexedDB and is saved after every step, so it can stop at any moment
   (browser closed, no network, phone asleep) and carry on from the same place later.
   Steps: read each page -> write answers -> save the document for review. */
(function (root) {
  'use strict'
  var DB = 'comrades-scan', STORE = 'jobs', BATCH = 4, MAX_Q = 60
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms) }) }

  /* ---------------- storage ---------------- */
  function openDb() {
    return new Promise(function (res, rej) {
      var r = root.indexedDB.open(DB, 1)
      r.onupgradeneeded = function () { r.result.createObjectStore(STORE, { keyPath: 'id' }) }
      r.onsuccess = function () { res(r.result) }
      r.onerror = function () { rej(r.error) }
    })
  }
  function wrap(req) { return new Promise(function (res, rej) { req.onsuccess = function () { res(req.result) }; req.onerror = function () { rej(req.error) } }) }
  async function getJob(id) { var db = await openDb(); try { return (await wrap(db.transaction(STORE).objectStore(STORE).get(id))) || null } finally { db.close() } }
  async function allJobs() { var db = await openDb(); try { return (await wrap(db.transaction(STORE).objectStore(STORE).getAll())) || [] } finally { db.close() } }
  async function delJob(id) { var db = await openDb(); try { await wrap(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id)) } finally { db.close() } }

  /* Save that never loses a newer token written by the page, and stops if the job was cancelled. */
  async function putJob(job, force) {
    var db = await openDb()
    try {
      return await new Promise(function (res, rej) {
        var t = db.transaction(STORE, 'readwrite'), s = t.objectStore(STORE), g = s.get(job.id)
        g.onsuccess = function () {
          var cur = g.result
          if (cur && !force) {
            if (cur.status === 'cancelled' && job.status !== 'cancelled') { var c = new Error('cancelled'); c.cancelled = true; rej(c); return }
            if ((cur.tokenAt || 0) > (job.tokenAt || 0)) { job.token = cur.token; job.tokenAt = cur.tokenAt }
          }
          job.updatedAt = Date.now()
          s.put(job)
        }
        t.oncomplete = function () { res(job) }
        t.onerror = t.onabort = function () { rej(t.error) }
      })
    } finally { db.close() }
  }

  /* ---------------- server calls ---------------- */
  function fail(msg) { var e = new Error(msg); e.fail = true; return e }

  async function api(job, action, payload) {
    var res, j
    try {
      res = await fetch(job.api, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({}, payload, { idToken: job.token, action: action })),
      })
      j = await res.json()
    } catch (e) { var n = new Error('No connection'); n.net = true; throw n }
    if (!j.ok) {
      var err = new Error(j.error || 'Request failed')
      err.server = true
      err.auth = /token|sign.?in|log.?in|auth|expired|unauthori/i.test(err.message)
      throw err
    }
    return j.data
  }
  async function tryApi(job, action, payload, tries) {
    var last, max = tries || 3
    for (var k = 0; k < max; k++) {
      try { return await api(job, action, payload) } catch (e) {
        last = e
        if (e.auth || e.cancelled) throw e
        if (e.server && k >= 1) throw e // the server said no twice: stop asking
        if (k < max - 1) await sleep(1500 * (k + 1))
      }
    }
    throw last
  }

  /* ---------------- notification (only when the app is not on screen) ---------------- */
  async function notify(title, body) {
    try {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
      var reg = root.registration || (root.navigator && root.navigator.serviceWorker && await root.navigator.serviceWorker.getRegistration())
      if (!reg) return
      if (root.clients && root.clients.matchAll) {
        var cs = await root.clients.matchAll({ type: 'window', includeUncontrolled: true })
        if (cs.some(function (c) { return c.visibilityState === 'visible' })) return
      } else if (root.document && root.document.visibilityState === 'visible') return
      await reg.showNotification(title, { body: body, icon: reg.scope + 'icon-192.png', tag: 'comrades-scan', data: { url: reg.scope + '#/labs' } })
    } catch (e) { /* notifications are a bonus */ }
  }

  /* ---------------- the steps ---------------- */
  async function readStage(job) {
    var n = job.pageTotal
    for (var i = 0; i < n; i++) {
      if (job.results[i] !== undefined) continue
      job.message = 'Reading page ' + (i + 1) + ' of ' + n + '…'
      await putJob(job)
      try { job.results[i] = await tryApi(job, 'scan_page', { image: job.pages[i], page: i + 1 }) }
      catch (e) {
        if (e.server && !e.auth) { job.results[i] = { skip: true }; job.skipped = (job.skipped || 0) + 1 } // one bad page must not sink the paper
        else throw e
      }
      job.pages[i] = '' // the photo is no longer needed once it has been read
      await putJob(job)
    }
  }

  function build(job) {
    var pages = []
    for (var i = 0; i < job.pageTotal; i++) { var r = job.results[i]; if (r && !r.skip) pages.push(r) }
    job.pagesRead = pages.length
    if (!pages.length) throw fail('No page could be read. Retake the photos: good light, whole page in the frame, text sharp.')
    var qs = [], seq = 0
    pages.forEach(function (p) {
      (p.questions || []).forEach(function (q) {
        var last = qs[qs.length - 1]
        if (q.continued && last) { last.text = last.text + '\n' + q.text; if (!last.marks && q.marks) last.marks = q.marks; return }
        if (qs.length >= MAX_Q) return
        seq++
        qs.push({ id: 'q' + seq, number: q.number, text: q.text, marks: q.marks, answer: '' })
      })
    })
    if (!qs.length) throw fail('No questions could be read. Retake the photos: good light, whole page in the frame, text sharp.')
    var first = function (k) { for (var i = 0; i < pages.length; i++) if (pages[i][k]) return pages[i][k]; return '' }
    var withCands = pages.filter(function (p) { return p.candidates && p.candidates.length })[0]
    job.meta = {
      isExamPaper: pages.some(function (p) { return p.isExamPaper }),
      unitCode: first('unitCode'), unitName: first('unitName'), duration: first('duration'),
      totalMarks: first('totalMarks'), instructions: first('instructions'),
      duplicate: pages.some(function (p) { return p.duplicate }),
    }
    job.cands = withCands ? withCands.candidates : []
    job.examType = first('examType') || 'CAT'
    job.ay = first('academicYear') || job.ay
    job.title = ((job.cands[0] && job.cands[0].code) || job.meta.unitCode || '') + ' ' + job.examType + (first('academicYear') ? ' ' + first('academicYear') : '')
    job.title = job.title.replace(/\s+/g, ' ').trim()
    job.questions = qs
    job.pages = []
    job.built = true
  }

  async function answerStage(job) {
    for (var pass = 0; pass < 2; pass++) {
      var missing = job.questions.filter(function (q) { return !q.answer })
      if (!missing.length) return
      if (pass === 1) await sleep(4000)
      for (var k = 0; k < missing.length; k += BATCH) {
        var batch = missing.slice(k, k + BATCH)
        var done = job.questions.filter(function (q) { return q.answer }).length
        job.message = 'Writing answers… ' + done + ' of ' + job.questions.length + ' ready'
        await putJob(job)
        var items = batch.map(function (q) { return { id: q.id, number: q.number, text: q.text, marks: q.marks } })
        try {
          var r = await tryApi(job, 'scan_answer', { unitCode: job.meta.unitCode, unitName: job.meta.unitName, questions: items })
          ;(r.answers || []).forEach(function (a) {
            var q = job.questions.filter(function (x) { return x.id === a.id })[0]
            if (q) q.answer = a.answer
          })
        } catch (e) {
          if (e.server && !e.auth) { job.answerError = e.message; await putJob(job); return } // quota etc.: do not repeat for every batch
          throw e
        }
        await putJob(job)
      }
    }
  }

  async function needsReview(job, reason) {
    job.status = 'needs_review'; job.reason = reason; job.message = ''
    await putJob(job)
    await notify('Your scan needs a quick look', 'Open Study Labs to choose the details and send it.')
  }

  async function finishStage(job) {
    var cand = job.cands[0], m = job.meta
    if (!m.isExamPaper) return needsReview(job, 'This does not look like an exam paper. Check the questions before you send it.')
    if (!cand) return needsReview(job, 'We could not match a unit. Choose it below, then send it.')
    if (job.questions.some(function (q) { return !q.answer })) return needsReview(job, (job.answerError ? job.answerError + ' ' : '') + 'Some answers are still missing. Write them, then send it.')
    job.message = 'Creating the document…'
    await putJob(job)
    try {
      await tryApi(job, 'scan_save', {
        unitId: cand.unitId, type: job.examType === 'CAT' ? 'cat' : 'paper', title: job.title, examType: job.examType,
        academicYear: String(job.ay || '').trim(), includeAnswers: true, duration: m.duration, totalMarks: m.totalMarks, instructions: m.instructions,
        questions: job.questions.map(function (q) { return { number: q.number, text: q.text, marks: q.marks, answer: q.answer } }),
      }, 1) // one try: a repeat could save the paper twice
    } catch (e) {
      if (e.server && !e.auth) return needsReview(job, e.message)
      throw e
    }
    job.savedQuestions = job.questions.length
    job.questions = []; job.status = 'done'; job.message = ''
    await putJob(job)
    await notify('Your paper is ready', job.title + ' was saved and sent for review.')
  }

  async function runInner(id) {
    var job = await getJob(id)
    if (!job || job.status === 'done' || job.status === 'failed' || job.status === 'cancelled' || job.status === 'needs_review') return job
    try {
      job.status = 'running'; job.error = ''
      await putJob(job)
      if (!job.built) { await readStage(job); build(job); await putJob(job) }
      await answerStage(job)
      await finishStage(job)
    } catch (e) {
      if (e && e.cancelled) return job
      try {
        if (e && e.fail) { job.status = 'failed'; job.error = e.message; job.message = '' }
        else if (e && e.auth) { job.status = 'paused'; job.error = 'signin'; job.message = 'Your sign-in expired. Open the app and tap Continue.' }
        else {
          job.retries = (job.retries || 0) + 1
          if (job.retries > 8) { job.status = 'failed'; job.error = 'This took too many tries. Please scan again.'; job.message = '' }
          else { job.status = 'paused'; job.error = ''; job.message = 'Waiting for a connection. It will carry on by itself.' }
        }
        await putJob(job)
        if (job.status === 'failed') await notify('Your scan stopped', job.error)
        else if (job.error === 'signin') await notify('Scan paused', 'Open Chuka Comrades to continue your scan.')
      } catch (x) { /* job was cancelled meanwhile */ }
    }
    return job
  }

  /** Runs one job. The lock makes sure only ONE runner (page or service worker) works on it. */
  function run(id) {
    var locks = root.navigator && root.navigator.locks
    if (!locks) return runInner(id)
    return locks.request('comrades-scan-' + id, { ifAvailable: true }, function (lock) { return lock ? runInner(id) : null })
  }

  /** Continues every unfinished job. Throws when a job is only waiting for the network, so the browser retries later. */
  async function resumeAll() {
    var jobs = await allJobs(), retry = false
    for (var i = 0; i < jobs.length; i++) {
      var j = jobs[i]
      if (j.status !== 'queued' && j.status !== 'running' && j.status !== 'paused') continue
      if (j.status === 'paused' && j.error === 'signin') continue
      var r = await run(j.id)
      if (r && r.status === 'paused' && !r.error) retry = true
    }
    if (retry) throw new Error('retry later')
  }

  root.__scanRunner = { getJob: getJob, putJob: putJob, allJobs: allJobs, delJob: delJob, run: run, resumeAll: resumeAll }
})(typeof self !== 'undefined' ? self : globalThis)
