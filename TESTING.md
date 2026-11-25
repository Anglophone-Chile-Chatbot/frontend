# Archive test checklist (for the research assistant)

Site: https://anglochile.vercel.app
Last updated: 2026-11-26. This list is kept current: when a feature changes, its test is marked **(changed YYYY-MM-DD)**. Re-check those.

**How to work.** Tick a box when the test is done. Under each test, write what you saw. Mark it **OK** or **PROBLEM**. For a problem, always give the exact question you typed, the newspaper, date and page, what you expected, and what happened. Note your device and browser once at the top.

Device and browser:

---

## A. Ask: answers and citations

- [ ] **A1. Do the sources really say what the answer says?** (laptop, 20 min). The most important test.
  1. Ask: *What war vessels were in port at Valparaiso?*
  2. Tap each small number in the answer. Read the highlighted passage on the page that opens.
  3. For each number, decide whether it really supports the sentence it is attached to.
  4. Repeat with 2 questions of your own (ships, trade, local events).
  - Works when: every number opens the right paper and date, every passage supports its sentence, and nothing is added that no source says.
  - Write down: for each question, numbers checked / numbers fully supported, and any unsupported sentence with its number.
  - Notes:

- [ ] **A2. Long, natural questions** (15 min). This used to fail completely and is the biggest recent fix.
  1. Ask: *Tell me everything the newspapers say about football and why it mattered to the British community in Chile.*
  2. Ask 3 long questions of your own (20+ words) on different topics: sport, mining, a disease, an election.
  - Works when: most of the 6 sources under each answer are on topic.
  - Write down: each question and how many of the 6 sources were on topic.
  - Notes:

- [ ] **A3. Modern words for old things** (10 min).
  1. Ask using modern words: *immigration, public health, sports results, stock market, labour strikes.*
  - Works when: the sources use period wording for the same thing (arrivals, sanitary, regatta, shares) and are on topic.
  - Write down: on-topic sources out of 6 for each word, and any word that found nothing useful.
  - Notes:

- [ ] **A4. Questions the archive cannot answer** (5 min) **(changed 2026-10-21)**.
  1. Ask about aeroplanes, television, and a person you invent.
  - Works when: the site says nothing matches. It never invents an answer. If the archive reaches its daily AI limit, the answer says so and search still works.
  - Write down: exactly what it said.
  - Notes:

- [ ] **A5. One newspaper only** (10 min).
  1. Use the folder icon by the question box to choose *The Valparaiso Herald*. Ask: *What ships arrived or departed?*
  2. Clear the choice and ask again.
  - Works when: with the Herald chosen, every source is from the Herald. After clearing, sources come from several papers.
  - Notes:

- [ ] **A6. When does "See every match" appear?** (10 min) **(changed 2026-10-05: the site now asks the AI, not a word list)**
  1. Ask each of these and look under the answer: *find all mentions of cricket*, *how many times are epidemics mentioned?*, *which issues report on elections?*, *Horse racing: every report, please*.
  2. Then ask: *Tell me about the mining industry*, *What did the papers say about the earthquake?*, *Who was the British consul?*
  - Works when: the first four each show "This answer draws on six passages at most. See every match for …" with sensible search words. The last three show no such line.
  - Write down: any question where the line appeared when it should not, or was missing when it should be there.
  - Notes:

- [ ] **A7. Follow-up questions** (25 min) **(changed 2026-11-26: parts 1, 3, 5, 6 and 7 updated after a re-check of your first report)**. Start each part with **New question** so it begins fresh. Under every answer there is now a small grey line: *Searched for: …* (what the site actually looked for) or *Treated as a new question*.
  1. **The wreck.** Ask: *What shipping news appears in these issues?* Then: *tell me more about the wreck*.
     - Works when: the second answer is about the ship the first answer said was wrecked, not about ships that simply arrived. **(changed 2026-11-26)** Today the first answer reports one wreck, the *Dalhousie*, which sank off Beechy Head; if your first answer reports a different wreck, it should follow that one. The grey line names that ship.
  2. **Going back.** Then ask: *go back to the first ship you mentioned. what was its cargo?*
     - Works when: it picks the first ship named in the very first answer (the *Arauco*, with coal from Lota) and the grey line says so.
  3. **Changing topic.** Then ask: *What did the papers say about the 1906 Valparaiso earthquake?*
     - Works when: the line says *Treated as a new question*, and the answer never mentions the ships or the wreck, not even to say it has nothing on them.
     - **(changed 2026-11-26)** Then open **Choose issues**, pick one issue (for example *The Star of Chile*, 5 Jan 1906), press Done, and ask: *What news is in this issue?* Works when: the grey line and the answer are about that issue only, with no ship, wreck or sport from earlier. Do the same with a newspaper chosen in **Newspapers and dates** and *What shipping news appears here?*
  4. **"The first one".** New question. Ask: *What sports were played by the British community?* Then: *tell me more about the first one*.
     - Works when: it continues with the first sport the answer listed (look at the answer's own order), not with an earlier question.
  5. **A detail from earlier.** New question. Ask: *What shipping news appears in these issues?* Then: *who was the captain of that British steamer from Lota?*
     - Works when: it names the captain if the passage gives one (it does: Captain Asplund of the *Arauco*), with a number you can tap. Also reload the page and ask it again: it should still find him.
     - **(changed 2026-11-26) Known gap, do not report again:** if you ask about something unrelated in between (a new topic), the site forgets the shipping thread on purpose, and may then not find the Lota steamer. Naming the ship (*the Arauco*) works.
  6. **"Which did you mean?"** **(changed 2026-11-26: now really appears)** New question. Ask: *What shipping news appears in these issues?* Then: *tell me more about the steamer*. Several steamers were listed, so the site should ask *Which did you mean?* with a button per steamer instead of guessing. Tap one.
     - Works when: the buttons are visible without scrolling on a phone and easy to tap, and after tapping, the answer is about the one you chose. Also reload while the question is showing: the buttons should still be there.
     - Write down any follow-up where it guessed when it should have asked, or asked when the answer was obvious.
  7. **Citation numbers.** On any answer with several numbers, compare the numbers in the text with the **Sources** list.
     - Where several numbers sit side by side (like 1 2 3 4), tap each one on a phone. Each must open its own passage, never its neighbour's.
     - Works when: number 1 in the text opens the same passage as item 1 in the list, and so on. Passages the answer did not use are listed separately under *Matched the search, not used*, without numbers. You never see raw codes such as `[CITE:…]`, `[S3]`, `(S2)` or long strings of letters and digits in the answer.
     - **(changed 2026-11-26)** When two Sources rows come from the same page, each also shows its first few words in italics, so they no longer look like duplicates.
  8. **Stop.** Ask a long question and press Stop right away, before any words appear. Then ask another and press Stop halfway through the answer.
     - Works when: stopped early, it says *Stopped before an answer was written. The passages it found are below.* (never "none of these answer the question"); stopped halfway, it keeps the words so far and adds *You stopped this answer.*
  9. **New question and Undo.** After a few questions, press **New question**. A bar says *Conversation cleared · Undo* for about 10 seconds. Press Undo. Then try again and let the bar disappear, and reload the page.
     - Works when: Undo brings back the whole conversation and any newspaper or date choice you had. Without Undo, the conversation is gone after a reload.
  - Write down: for each part, the questions, the grey line you saw, and OK or PROBLEM.
  - Notes:

- [ ] **A8. Dates for all newspapers, and the supplement** (10 min) **(changed 2026-11-24)**.
  1. Open **Newspapers and dates**. At the top there is a **Dates** block with *From year* and *To year*, and *Exact dates…*. Choose 1891 to 1891 without choosing a newspaper, and ask: *What ships arrived?*
     - Works when: every source is from 1891, from any paper, and the label near the question box says *All newspapers, 1891*. Then choose one newspaper too and check both choices show and both apply.
  2. Choose issues to ask about and find *The Chilian Times*, 14 March 1891. There are two: the issue and its **Supplement**. Open the supplement from Browse and from a citation.
     - Works when: one of them is labelled *Supplement* in the list, in the citation, in the Sources list and at the top of the page viewer. You never see a file name (anything like "Chilean Times 2").
  - Notes:

## B. Browse: finding every mention

- [ ] **B1. "Find all": how clean is the list?** (laptop, 30 min). Known to contain some junk. We need to know how much.
  1. On Ask, type *find all mentions of cricket*. Under the answer, tap **See every match**.
  2. Note the headline (for example "583 passages across 15 issues").
  3. Open the first 20 results. Mark each as a real mention or junk (an advert, or an unrelated use of the word).
  4. Repeat for *epidemics* and *mining*.
  - Write down: for each topic, the headline, real mentions out of 20, and 2 junk examples (paper, date, page, what it was).
  - Notes:

- [ ] **B2. "Find all": what does it miss?** (30 min). Every miss tells us which words to add.
  1. Open one issue and read 2 pages (text view).
  2. List every passage about sport, disease, elections or shipwrecks.
  3. Search Browse for that topic, tap that issue under **By issue**, and check whether your passages are in the list.
  - Write down: every missed passage (paper, date, page, first few words, the word you searched).
  - Notes:

- [ ] **B3. The "By issue" counts** (5 min).
  1. Search *mining*. Open **By issue** and tap a row.
  - Works when: the list narrows to that paper and date, and the count at the top matches the row.
  - Notes:

## C. Reading the pages

- [ ] **C1. Is the typed text faithful to the scan?** (laptop, 30 min).
  1. Open one Herald, one Star of Chile and one Mercury issue.
  2. On one page of each, compare one full column of the scan with the text, word by word.
  - Small letter errors are expected. Missing paragraphs or columns, and wrong names, numbers or dates, are problems.
  - Write down: each error, with what the scan says and what the text says.
  - Notes:

- [ ] **C2. Are newspaper names and dates right?** (15 min).
  1. For every issue on Browse, compare the masthead on the first newspaper page with the name and date the site shows.
  - Notes:

- [ ] **C3. Reading a scan comfortably** (phone and laptop, 10 min) **(changed 2026-10-03: Safari pinch added)**
  1. Open a scan. Pinch (phone or trackpad), double-tap, drag, and use the slider.
  2. Switch to Text and back. Try **Read the whole issue**.
  - Works when: zoom is smooth and deep enough for small print, Text and Scan keep your zoom, and the whole issue opens in a new tab.
  - Notes:

- [ ] **C4. Is "Plates" explained?** (phone, 2 min) **(changed 2026-10-05: new one-line explanation)**
  1. Open *The Star of Chile*, 3 December 1904, and tap the **Plates** tab.
  - Works when: the first line says what a plate is (an engraving, photograph or illustration from the issue) before the count, and it reads clearly on a phone.
  - Notes:

- [ ] **C5. Are the plates all real pictures?** (laptop, 5 min) **(changed 2026-10-24: three junk plates removed)**
  1. Open *The Star of Chile*, 3 December 1904, page 8. It should show **2** plates (a woman with a child, and Valparaiso Bay), not 3. The empty, see-through strip between them is no longer a plate.
  2. Open the other Star of Chile issue's page 13 (the railway timetable). It should show **no** plates.
  3. Open the Plates tab of every Star of Chile issue and scroll through.
  - Works when: every plate shows a printed picture, ad drawing or lettering. Report any plate that is blank paper, a smudge, or a thin sliver of a line, with the newspaper, date and page.
  - Notes:

## D. Phone, saving and everyday use

- [ ] **D1. A full session on a phone** (20 min).
  1. On the phone only: ask 3 questions, open sources, read a scan, use Browse, and use the menu button at the top left.
  - Works when: nothing is cut off, nothing scrolls sideways, every button is easy to tap, and you never lose your place.
  - Notes:

- [ ] **D2. Is the chat saved?** (5 min) **(changed 2026-10-03: two tabs now stay in sync)**
  1. Ask 2 questions. Reload. Close the tab and reopen the site.
  2. Open the site in a second tab. Check it shows the same chat.
  3. Check the countdown at the top. Press **Delete now** twice.
  - Works when: the chat survives the reload and the reopen, both tabs match, the countdown shows about 7 days, and delete clears it.
  - Notes:

- [ ] **D3. How fast does it feel?** (10 min).
  1. Ask 5 questions. Roughly time until the first words appear, and until the answer finishes. Time one Browse search.
  - Expected: first words in a few seconds, full answer within about 10 seconds.
  - Write down: timings, and whether you were on wifi or mobile data.
  - Notes:

- [ ] **D4. Use it like a historian for 30 minutes.**
  1. Pick a real research question about the British in 1800s Chile and try to answer it using only this site.
  - Write down: your question, what you found, and the 3 things you would change first.
  - Notes:

## Anything else
Ideas, annoyances, things you liked, questions the site could not answer:
