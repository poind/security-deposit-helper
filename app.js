const $ = (id) => document.getElementById(id);
let STATES = [];
let current = null; // last calculated result, used to build the letter

fetch('states.json')
  .then((r) => r.json())
  .then((data) => {
    STATES = data.states;
    $('reviewed').textContent = data.last_reviewed;
    for (const s of STATES) $('state').add(new Option(s.state, s.code));
  })
  .catch(() => alert('Could not load state data. Please reload the page.'));

// Dates are handled as local calendar dates (no time zones).
function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(start, days, dayType) {
  const d = new Date(start);
  if (dayType !== 'business') {
    d.setDate(d.getDate() + days);
    return d;
  }
  // Business days: skips weekends only, not holidays.
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) left--;
  }
  return d;
}

const fmtDate = (d) => d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
const fmtMoney = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dayWord = (s) => (s.day_type === 'business' ? 'business days' : 'days');

$('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const s = STATES.find((x) => x.code === $('state').value);
  if (!s) return;

  const moveout = parseDate($('moveout').value);
  const deposit = parseFloat($('deposit').value);
  const returned = parseFloat($('returned').value) || 0;
  const itemized = document.querySelector('input[name="itemized"]:checked').value === 'yes';
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // In a few states the clock only starts when the tenant asks for the deposit.
  // We assume the letter below is that request and count from today.
  const fromDemand = s.demand_starts_clock && s.deadline_days != null;
  const start = fromDemand && today > moveout ? today : moveout;
  const deadline = s.deadline_days == null ? null : addDays(start, s.deadline_days, s.day_type);
  const passed = deadline ? today > deadline : null;
  const daysDiff = deadline ? Math.round(Math.abs(today - deadline) / 86400000) : null;

  current = { s, moveout, deposit, returned, itemized, deadline, passed, today, fromDemand };

  $('r-state').textContent = s.state;

  $('r-flag').hidden = !s.flag;
  $('r-flag').textContent = s.flag ? 'Heads up: ' + s.flag : '';

  const status = $('r-status');
  if (!deadline) {
    status.className = 'status unknown';
    status.textContent = 'This state does not set a fixed number of days.';
  } else if (fromDemand) {
    status.className = 'status unknown';
    status.textContent = `In ${s.state} the clock starts when you ask for your deposit back. If you send the letter below today, the deadline is ${fmtDate(deadline)}. If you already asked in writing, count ${s.deadline_days} ${dayWord(s)} from that date instead.`;
  } else if (passed) {
    status.className = 'status passed';
    status.textContent = `The deadline was ${fmtDate(deadline)}. It passed ${daysDiff} day${daysDiff === 1 ? '' : 's'} ago.`;
  } else {
    status.className = 'status';
    status.textContent = daysDiff === 0
      ? `The deadline is today, ${fmtDate(deadline)}.`
      : `The deadline is ${fmtDate(deadline)}. That is ${daysDiff} day${daysDiff === 1 ? '' : 's'} from now.`;
  }

  let dl = deadline
    ? `${s.deadline_days} ${dayWord(s)} ${s.deadline_trigger}.`
    : 'No fixed deadline in state law.';
  if (s.deadline_days_no_deductions != null) {
    dl += ` If the landlord is not keeping any of it, the deadline is ${s.deadline_days_no_deductions} ${dayWord(s)}.`;
  }
  if (s.deadline_note) dl += ' ' + s.deadline_note;
  if (deadline && s.day_type === 'business') dl += ' (Our date skips weekends but not holidays, so the real date may be a little later.)';
  $('r-deadline').textContent = dl;

  $('r-itemization').textContent = s.itemization;
  $('r-penalty').textContent = s.penalty;
  $('r-interest').textContent = s.interest;
  $('r-citation').textContent = s.citation;
  $('r-source').href = s.source_url;

  $('result').hidden = false;
  $('letter-section').hidden = false;
  buildLetter();
  $('result').scrollIntoView({ behavior: 'smooth' });
});

function buildLetter() {
  if (!current) return;
  const { s, moveout, deposit, returned, itemized, deadline, passed, today, fromDemand } = current;
  const val = (id, fallback) => $(id).value.trim() || fallback;
  const owed = Math.max(deposit - returned, 0);
  const replyBy = new Date(today);
  replyBy.setDate(replyBy.getDate() + 14);
  // Never ask for payment sooner than the legal deadline.
  const payBy = deadline && deadline > replyBy ? deadline : replyBy;

  const p = [];
  p.push(`I rented ${val('r-addr', '[rental address]')} and moved out on ${fmtDate(moveout)}. I paid a security deposit of ${fmtMoney(deposit)}.` +
    (returned > 0 ? ` So far I have received ${fmtMoney(returned)} back.` : ' I have not received any of it back.'));

  const disagree = ' I received your list of deductions, but I do not agree with it. [Explain which deductions you disagree with and why.]';
  if (fromDemand) {
    p.push(`Please treat this letter as my written demand for the return of my deposit. Under ${s.state} law (${s.citation}), you have ${s.deadline_days} ${dayWord(s)} from this demand to return my deposit or send me a written, itemized list of deductions. That deadline is ${fmtDate(deadline)}.` +
      (itemized ? disagree : ''));
  } else if (!deadline) {
    p.push(`Under ${s.state} law (${s.citation}), a landlord must return a tenant's security deposit, minus any lawful deductions, within a reasonable time after the tenancy ends.` +
      (itemized ? ' I received your list of deductions, but I do not agree with it. [Explain which deductions you disagree with and why.]' : ' I have not received a written list of any deductions.'));
  } else if (passed) {
    p.push(`Under ${s.state} law (${s.citation}), you had ${s.deadline_days} ${dayWord(s)} to return my deposit or send me a written, itemized list of deductions. That deadline was ${fmtDate(deadline)}, and it has passed.` +
      (itemized ? ' I received your list of deductions, but I do not agree with it. [Explain which deductions you disagree with and why.]' : ' I have not received an itemized list of deductions.'));
  } else {
    p.push(`Under ${s.state} law (${s.citation}), you have ${s.deadline_days} ${dayWord(s)} to return my deposit or send me a written, itemized list of deductions. That deadline is ${fmtDate(deadline)}.` +
      (itemized ? ' I received your list of deductions, but I do not agree with it. [Explain which deductions you disagree with and why.]' : ''));
  }

  p.push(`Under ${s.state} law, ${s.penalty_letter}.`);

  p.push(`I am asking you to send ${fmtMoney(owed)} to me at the address above by ${fmtDate(payBy)}. If I do not receive it, I am prepared to file a claim in small claims court and ask for everything the law allows.`);

  $('letter').value = [
    val('t-name', '[Your name]'),
    val('t-addr', '[Your mailing address]'),
    '',
    fmtDate(today),
    '',
    val('l-name', '[Landlord name]'),
    val('l-addr', '[Landlord address]'),
    '',
    `Re: Return of my security deposit — ${val('r-addr', '[rental address]')}`,
    '',
    `Dear ${val('l-name', '[Landlord name]')},`,
    '',
    p.join('\n\n'),
    '',
    'Sincerely,',
    '',
    val('t-name', '[Your name]'),
  ].join('\n');
}

// Typing a name or address refreshes the letter. Edits made directly in the
// letter box are replaced when that happens, so fill these in first.
for (const id of ['t-name', 't-addr', 'l-name', 'l-addr', 'r-addr']) {
  $(id).addEventListener('input', buildLetter);
}

$('copy').addEventListener('click', async () => {
  const btn = $('copy');
  try {
    await navigator.clipboard.writeText($('letter').value);
  } catch {
    $('letter').select();
    document.execCommand('copy');
  }
  btn.textContent = 'Copied';
  setTimeout(() => (btn.textContent = 'Copy letter'), 1500);
});

$('pdf').addEventListener('click', () => {
  if (!window.jspdf) {
    alert('The PDF tool did not load. Check your connection and reload, or copy the letter into a document instead.');
    return;
  }
  const doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter' });
  const margin = 72;
  const lineHeight = 16;
  const pageBottom = doc.internal.pageSize.getHeight() - margin;
  doc.setFont('times', 'normal');
  doc.setFontSize(12);
  // jsPDF's built-in fonts can't draw every character; swap the long dash.
  const text = $('letter').value.replace(/—/g, '-');
  const lines = doc.splitTextToSize(text, doc.internal.pageSize.getWidth() - margin * 2);
  let y = margin;
  for (const line of lines) {
    if (y > pageBottom) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += lineHeight;
  }
  doc.save('security-deposit-letter.pdf');
});
