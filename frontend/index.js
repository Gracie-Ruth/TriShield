const API = 'https://brooke-granitic-stodgily.ngrok-free.dev/predict';

const ta = document.getElementById('inputText');
ta.addEventListener('input', () => {
  document.getElementById('charCount').textContent = ta.value.length;
});

function clearInput() {
  ta.value = '';
  document.getElementById('charCount').textContent = 0;
  document.getElementById('results').style.display = 'none';
  document.getElementById('errorMsg').style.display = 'none';
}

// ── insight logic ──────────────────────────────────────────────────────
function chipInfo(p) {
  if (p >= 0.65) return { cls: 'chip-high', label: '↑ High AI' };
  if (p >= 0.4)  return { cls: 'chip-mid',  label: '~ Uncertain' };
  return               { cls: 'chip-low',  label: '↓ Low AI' };
}

function semInsight(p) {
  if (p >= 0.75) return 'DeBERTa\'s [CLS] embeddings show strong AI-pattern activation — vocabulary choices, semantic density, and sentence coherence are characteristic of AI-authored text.';
  if (p >= 0.5)  return 'Moderate semantic AI signal. Deep contextual features lean toward AI generation, though domain-specific language or deliberate style may be influencing the score.';
  if (p >= 0.3)  return 'Weak semantic AI signal. Contextual embeddings show irregular phrasing and stylistic inconsistencies more typical of a human author.';
  return               'Very low semantic AI probability. DeBERTa finds strong markers of natural, human-like language patterns across this text.';
}

function synInsight(p) {
  if (p >= 0.75) return 'High syntactic uniformity: sentence lengths are highly consistent, function-word density matches AI output, and POS-bigram entropy is low — classic generated text signatures.';
  if (p >= 0.5)  return 'Moderate syntactic regularity. Some sentence-length variation and POS patterns lean AI, but structural irregularity makes the signal ambiguous.';
  if (p >= 0.3)  return 'Syntactic fingerprint leans human: notable sentence-length variance, natural function-word usage, and elevated grammatical pattern entropy.';
  return               'Strong human syntactic profile — high structural variance and natural function-word distribution are inconsistent with AI generation patterns.';
}

function retInsight(p) {
  if (p >= 0.75) return 'High FAISS similarity to AI-authored neighbours. Multiple sentences closely match known AI-generated samples in the retrieval index.';
  if (p >= 0.5)  return 'Moderate retrieval signal. Some sentences map closely to AI-generated neighbours, but overall embedding proximity is mixed.';
  if (p >= 0.3)  return 'Low retrieval similarity to AI neighbours. Most sentences find closer matches to human-authored content in the FAISS index.';
  return               'Very low embedding-space similarity to AI samples — sentences sit far from AI-generated clusters in the retrieval index.';
}

function overallInsight(sem, syn, ret, isAI) {
  const streams = [
    { name: 'semantic', label: 'deep semantic analysis (DeBERTa)', val: sem },
    { name: 'syntax',   label: 'syntactic feature analysis (Random Forest)', val: syn },
    { name: 'retrieval',label: 'retrieval similarity (FAISS/E5)', val: ret }
  ].sort((a, b) => b.val - a.val);

  const threshold = isAI ? 0.5 : 0.5;
  const agreeing = [sem, syn, ret].filter(v => isAI ? v >= threshold : v < threshold).length;

  const top = streams[0];
  let lead = `The strongest signal comes from <strong>${top.label}</strong>. `;

  if (agreeing === 3) {
    lead += 'All three streams agree — this is a <strong>high-confidence verdict</strong> with strong ensemble alignment.';
  } else if (agreeing === 2) {
    lead += 'Two of three streams support this verdict; one stream is ambiguous, yielding a <strong>moderate confidence score</strong>.';
  } else {
    lead += 'The streams are split — this is a <strong>borderline case</strong>. Treat the result with caution and consider additional context.';
  }

  return lead;
}

// ── main ───────────────────────────────────────────────────────────────
async function runDetect() {
  const text = ta.value.trim();
  const errorEl   = document.getElementById('errorMsg');
  const resultsEl = document.getElementById('results');
  const btn       = document.getElementById('analyzeBtn');
  const spinner   = document.getElementById('spinner');
  const btnLabel  = document.getElementById('btnLabel');

  errorEl.style.display = 'none';
  resultsEl.style.display = 'none';

  if (!text) {
    errorEl.textContent = 'Please enter some text before running analysis.';
    errorEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  spinner.style.display = 'block';
  btnLabel.textContent = 'Analyzing…';

  try {
    const res  = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const data = await res.json();

    const isAI = data.final_prediction !== 'Human-written';
    const { final_probability: fp, confidence: conf } = data;
    const { fairda_semantic: sem, syntax: syn, retrieval: ret } = data.stream_probabilities;

    // Verdict card
    const card = document.getElementById('verdictCard');
    card.className = 'verdict-card ' + (isAI ? 'ai' : 'human');
    const vl = document.getElementById('verdictLabel');
    vl.className = 'verdict-label ' + (isAI ? 'ai' : 'human');
    vl.textContent = data.final_prediction;

    document.getElementById('finalProb').textContent = fp.toFixed(4);
    document.getElementById('confStat').textContent  = conf.toFixed(4);
    document.getElementById('confVal').textContent   = (conf * 100).toFixed(1) + '%';

    // Overall insight
    document.getElementById('overallInsight').innerHTML = overallInsight(sem, syn, ret, isAI);

    // Stream data
    [
      { score: 'semScore', bar: 'semBar', chip: 'semChip', insight: 'semInsight', val: sem, fn: semInsight },
      { score: 'synScore', bar: 'synBar', chip: 'synChip', insight: 'synInsight', val: syn, fn: synInsight },
      { score: 'retScore', bar: 'retBar', chip: 'retChip', insight: 'retInsight', val: ret, fn: retInsight }
    ].forEach(s => {
      document.getElementById(s.score).textContent = s.val.toFixed(3);
      document.getElementById(s.insight).textContent = s.fn(s.val);
      const ci = chipInfo(s.val);
      const chipEl = document.getElementById(s.chip);
      chipEl.textContent = ci.label;
      chipEl.className = 'chip ' + ci.cls;
    });

    resultsEl.style.display = 'flex';

    // Animate bars after paint
    requestAnimationFrame(() => setTimeout(() => {
      document.getElementById('semBar').style.width   = (sem  * 100).toFixed(1) + '%';
      document.getElementById('synBar').style.width   = (syn  * 100).toFixed(1) + '%';
      document.getElementById('retBar').style.width   = (ret  * 100).toFixed(1) + '%';
      document.getElementById('confFill').style.width = (conf * 100).toFixed(1) + '%';
    }, 60));

  } catch (e) {
    errorEl.textContent = 'Could not connect to the backend. Make sure the API server is running.';
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
    btnLabel.textContent = 'Run Analysis';
  }
}