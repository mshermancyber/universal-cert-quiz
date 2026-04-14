# Cert Quiz Trainer PWA — v2

Universal certification exam simulator. Load any test bank CSV and it configures itself automatically.

---

## CSV Format

Every question bank is a self-describing CSV. The first row is the header, every subsequent row is a question. Test metadata is embedded in each row.

### Required Header (exact column names):

```
TEST_NAME,TEST_CODE,PASS_SCORE,TOTAL_QUESTIONS,SCORED_QUESTIONS,UNSCORED_QUESTIONS,TIME_MINUTES,DOMAIN,QUESTION,OPTION_A,OPTION_B,OPTION_C,OPTION_D,CORRECT_ANSWER,EXPLANATION
```

### Column definitions:

| Column | Description | Example |
|---|---|---|
| TEST_NAME | Full name of the exam | AWS Certified Cloud Practitioner |
| TEST_CODE | Short exam code | CLF-C02 |
| PASS_SCORE | Minimum passing score (scaled) | 700 |
| TOTAL_QUESTIONS | Questions per exam session | 65 |
| SCORED_QUESTIONS | Questions that count toward score | 50 |
| UNSCORED_QUESTIONS | Randomly hidden unscored questions | 15 |
| TIME_MINUTES | Exam time limit in minutes | 90 |
| DOMAIN | Topic domain for this question | Security and Compliance |
| QUESTION | The question text | What is... |
| OPTION_A | Answer choice A | First option |
| OPTION_B | Answer choice B | Second option |
| OPTION_C | Answer choice C | Third option |
| OPTION_D | Answer choice D | Fourth option |
| CORRECT_ANSWER | Correct letter (A, B, C, or D) | B |
| EXPLANATION | Why the answer is correct | Because... |

### Rules:
- All metadata columns (TEST_NAME through TIME_MINUTES) must be consistent across all rows
- The app reads config from the FIRST data row
- SCORED_QUESTIONS + UNSCORED_QUESTIONS MUST equal TOTAL_QUESTIONS
- The file must contain at least TOTAL_QUESTIONS rows of valid questions
- Quote fields containing commas with double-quotes

---

## Included Question Banks

| File | Exam | Questions | Time | Pass |
|---|---|---|---|---|
| aws_clp_clf-c02.csv | AWS Cloud Practitioner | 400 (draws 65) | 90 min | 700 |
| cissp_questions.csv | CISSP  | 400 (draws 125) | 180 min | 700 |
| Test Folder Has Many Additional Tests |
---

## Generating Future Test Banks

Ask Claude:
> "Generate a CISSP question bank CSV for the Cert Quiz Trainer. Use this header: TEST_NAME,TEST_CODE,PASS_SCORE,TOTAL_QUESTIONS,SCORED_QUESTIONS,UNSCORED_QUESTIONS,TIME_MINUTES,DOMAIN,QUESTION,OPTION_A,OPTION_B,OPTION_C,OPTION_D,CORRECT_ANSWER,EXPLANATION. CISSP config: TEST_NAME=Certified Information Systems Security Professional, TEST_CODE=CISSP, PASS_SCORE=700, TOTAL_QUESTIONS=125, SCORED_QUESTIONS=100, UNSCORED_QUESTIONS=25, TIME_MINUTES=180."

### Common Exam Configs:

**CISSP:**
TOTAL_QUESTIONS=125, SCORED_QUESTIONS=100, UNSCORED_QUESTIONS=25, TIME_MINUTES=180, PASS_SCORE=700

**CISM:**
TOTAL_QUESTIONS=150, SCORED_QUESTIONS=135, UNSCORED_QUESTIONS=15, TIME_MINUTES=240, PASS_SCORE=450

**AWS Security Specialty (SCS-C02):**
TOTAL_QUESTIONS=65, SCORED_QUESTIONS=50, UNSCORED_QUESTIONS=15, TIME_MINUTES=170, PASS_SCORE=750

**CompTIA Security+ (SY0-701):**
TOTAL_QUESTIONS=90, SCORED_QUESTIONS=85, UNSCORED_QUESTIONS=5, TIME_MINUTES=90, PASS_SCORE=750

**CCSP:**
TOTAL_QUESTIONS=125, SCORED_QUESTIONS=100, UNSCORED_QUESTIONS=25, TIME_MINUTES=240, PASS_SCORE=700

---

## Deploy to GitHub Pages

```bash
git add .
git commit -m "v2 - universal exam simulator"
git push origin main
```

Then Settings → Pages → Branch: main → Save.

URL: https://mshermancyber.github.io/aws-quiz-trainer
