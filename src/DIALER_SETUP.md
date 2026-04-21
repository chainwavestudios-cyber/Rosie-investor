# Predictive Dialer Setup Guide

## Overview
The predictive dialer now supports 2-3 lines with answering machine detection (AMD). Each line can dial independently while other team members use direct dial elsewhere.

## Contact Lists
- **Import CSV**: Create named contact lists (e.g., "Q2 2025 Leads", "Cold Calls")
- **Delete old**: Optionally clear all existing leads before importing
- **Start dialer**: Choose a list + line count, then launch

## Phone Numbers (Twilio)
You need **1-3 phone numbers** configured as environment secrets in the dashboard:

### Current Setup
- `TWILIO_FROM_NUMBER` → Line 1 (main number)
- `TWILIO_FROM_NUMBER_2` → Line 2 (optional)
- `TWILIO_FROM_NUMBER_3` → Line 3 (optional)

### How to Configure
1. Go to **Dashboard → Settings → Secrets**
2. Add the Twilio numbers:
   - `TWILIO_FROM_NUMBER`: Your first Twilio number (e.g., +12165550123)
   - `TWILIO_FROM_NUMBER_2`: Your second number (optional, e.g., +12165550124)
   - `TWILIO_FROM_NUMBER_3`: Your third number (optional, e.g., +12165550125)

### Example
```
TWILIO_FROM_NUMBER = +12165550123
TWILIO_FROM_NUMBER_2 = +12165550124
TWILIO_FROM_NUMBER_3 = +12165550125
```

## Line Count Options
- **2 Lines**: Use when another computer is running direct dial
- **3 Lines**: Max throughput (all lines active)

## Voicemail Detection (AMD)
- Automatically hangs up when voicemail is detected
- Logs "Voicemail detected" to activity log (purple)
- Immediately dials next lead in queue

## Activity Log
- See real-time call status, voicemail detections, and errors
- Purple = voicemail, Green = connected, Gold = dialing, Red = no answer

---

**Note**: No complex changes needed. Just add the extra phone numbers as secrets if you want 2-3 lines.