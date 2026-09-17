# InterviewMitra Pro - Backend (P2: Resume Parsing & Question Generation)

This repository contains the backend Python 3.12 Lambda functions for **InterviewMitra Pro**, built for local testing with AWS SAM and deployment to AWS Lambda & API Gateway.

> [!IMPORTANT]
> **Zero Bedrock/Textract/Comprehend/Transcribe**:
> - Resume text extraction is executed in-process using `pypdf`.
> - Question generation is executed using deterministic substring skill-tag matching over `question_bank.json` with generic fallbacks per difficulty level.

---

## Architecture & Components

```
interviewmitra-pro/
├── template.yaml                       # AWS SAM Template (Python 3.12, API Gateway routes)
├── question_bank.json                  # Curated repository of 20 interview questions
├── resume_parser/
│   ├── app.py                          # Lambda handler for PDF extraction using pypdf
│   └── requirements.txt                # pypdf>=5.0.0
├── generate_questions/
│   ├── app.py                          # Lambda handler: substring skill matching + generic fallback
│   ├── question_bank.json              # Bundled question bank for Lambda artifact
│   └── requirements.txt                # Standard library dependencies
├── events/
│   ├── resume_parser_event.json        # Test event with base64 PDF
│   ├── generate_questions_event.json   # Test event (software, round 1)
│   └── generate_questions_fallback.json# Test event verifying fallback
└── tests/
    └── test_local.py                   # Automated test suite (8 tests)
```

---

## 1. Resume Parser (`resume_parser`)

Extracts text from a base64-encoded PDF without calling any external AWS AI services.

- **Endpoint**: `POST /parse-resume`
- **Request Format**:
  ```json
  {
    "pdf_base64": "<base64_string>"
  }
  ```
- **Response Format**:
  ```json
  {
    "extracted_text": "Alex Mercer - Software Engineer...",
    "page_count": 1,
    "character_count": 139
  }
  ```

---

## 2. Question Generation (`generate_questions`)

Selects the best question matching the candidate's target role and round number (difficulty 1 = Warm-up, 2 = Behavioral, 3 = Stress) by checking which `skill_tags` appear as substrings in `resume_text.lower()`.

- **Endpoint**: `POST /generate-questions`
- **Request Format**:
  ```json
  {
    "resume_text": "Experienced Python engineer with teamwork skills...",
    "role": "software",
    "round_number": 1
  }
  ```
- **Response Format**:
  ```json
  {
    "question": "Can you explain the difference between lists and tuples in Python, and how you use them when solving problems?",
    "difficulty": 1,
    "matched_tags": ["python", "problem-solving"],
    "question_id": "q_sw_1_01"
  }
  ```
- **Fallback**: If no skill tags match the candidate's resume, it automatically selects a generic question for that difficulty level.

---

## 3. Question Bank (`question_bank.json`)

20 questions distributed across:
- **Roles**: `software`, `retail`, `general`
- **Difficulty**: `1` (Warm-up), `2` (Behavioral), `3` (Stress)
- **Skills Covered**: `python`, `java`, `teamwork`, `leadership`, `customer service`, `problem-solving`, `communication`, `deadlines`.

---

## 4. Local Testing & Verification

### Run Automated Unit Tests
```bash
python tests/test_local.py
```

### Validate SAM Template
```bash
sam validate
```

### Local SAM Invocation (Requires Docker for container emulation)
```bash
# Test Resume Parser
sam local invoke ResumeParserFunction -e events/resume_parser_event.json

# Test Question Generation
sam local invoke GenerateQuestionsFunction -e events/generate_questions_event.json

# Test Fallback Question Generation
sam local invoke GenerateQuestionsFunction -e events/generate_questions_fallback.json
```
