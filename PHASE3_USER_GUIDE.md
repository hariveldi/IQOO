# Phase 3 Features - User Guide

## Quick Start

### Voice Capture
1. Navigate to any page
2. Click blue FAB button (bottom-right)
3. Click red Mic icon
4. Click "Start Recording"
5. Speak your task naturally
6. Click "Stop Recording"
7. Review and edit the transcript if needed
8. Click "Extract Task"
9. Task is created with extracted title and description

**Browser Support**: Chrome, Safari, Edge (Firefox limited)

### Image Capture & OCR
1. Click blue FAB button
2. Click green Camera icon
3. Take photo or select from gallery
4. Choose image type:
   - **DOCUMENT**: Highest OCR accuracy
   - **WHITEBOARD**: Board capture optimization
   - **IMAGE**: General photo
   - **SCREENSHOT**: Screen capture
5. Optional: Click "Extract Text" to run OCR
6. Review extracted text
7. Click "Create Task"

**First OCR Run**: 3-5 seconds (library loads)  
**Subsequent OCRs**: <1 second (cached)

### Focus Sessions
1. Navigate to any task detail page
2. Click the green Play button (top-right)
3. FocusSessionModal opens with timer
4. Click "Start Recording"
5. Timer starts counting elapsed minutes
6. Work on your task
7. Click "Pause" if you need a break
8. Click "Resume" to continue
9. When done, click "Save & Complete"
10. Actual time is saved to task, status → COMPLETED

**Time Format**: MM:SS or HH:MM:SS

### Dashboard
1. Click the chart icon in bottom navigation
2. View your productivity stats:
   - **Completion Rate**: % of tasks completed
   - **Time Tracked**: Total hours/minutes logged
   - **In Progress**: Active task count
   - **Overdue**: Past-deadline tasks needing attention
   - **Priority Distribution**: Breakdown by priority level
   - **Task Status**: Visual count of all statuses

**Updates**: Real-time, based on current task list

### Reminders
1. Open a task detail page
2. Scroll to "Reminders" section
3. Click "+ Add Reminder"
4. Set reminder time and type:
   - **Before deadline**: Alert before task due
   - **Notification**: Browser notification
   - **Email**: Email reminder
5. Click "Save"
6. Upcoming reminders display above the form

## API Integration

All new features integrate with existing API:

### Voice Extraction
```
POST /api/ai/extract/voice
Body: { transcript: "user's spoken words" }
```

### Image Extraction
```
POST /api/ai/extract/image
Body: { imageBase64: "...", imageType: "DOCUMENT|WHITEBOARD|IMAGE|SCREENSHOT" }
```

### Focus Session Save
```
PATCH /api/tasks/:id
Body: { 
  status: "COMPLETED",
  actualMinutes: 45  // elapsed time from timer
}
```

### Dashboard Data
Uses existing GET endpoints:
- `GET /api/tasks` - Task list with status/priority
- Results aggregated client-side for analytics

## Troubleshooting

### "Your browser doesn't support speech recognition"
- Update your browser to a recent version
- Supported: Chrome 25+, Safari 14.1+, Edge 79+
- Fallback: Use manual text input instead

### OCR not extracting text
- Ensure image is clear and readable
- Try document-type image for better results
- Check browser console for errors
- Note: Very small text may not be detected

### Focus session timer seems slow/fast
- Timer is client-side only (no server sync)
- Browser tab must remain active
- Switching tabs may pause/resume
- Time is saved once on completion

### Dashboard not updating
- Dashboard pulls fresh data on page load
- Create/complete a task to see updates
- Try refreshing the page
- Check auth token is valid

## Browser DevTools

### Debug Voice Recognition
```javascript
// In browser console
window.SpeechRecognition || window.webkitSpeechRecognition
```

### Debug OCR Progress
```javascript
// Check if Tesseract loaded
window.Tesseract
```

### Check Focus Timer
```javascript
// In FocusSessionModal
console.log('Elapsed:', elapsed, 'ms')
```

## Best Practices

### Voice Capture
✅ Speak clearly and naturally
✅ Use complete sentences for better extraction
✅ Short pauses between thoughts
✅ Edit transcript for accuracy
❌ Don't shout or whisper too quietly

### Image Capture
✅ Good lighting on document
✅ Straight angle (not tilted)
✅ Entire document in frame
✅ Dark text on light background
❌ Blurry or partially visible text

### Focus Sessions
✅ Use for deep work tasks only
✅ Start timer when focus begins
✅ Save immediately after completion
✅ Track hard deadline tasks
❌ Don't leave timer running between tasks

## Future Enhancements

- Real OpenAI/Anthropic API for smarter extraction
- Push notifications for reminders
- Offline sync when no internet
- Calendar integrations (Google, Outlook)
- Team collaboration features
- Time analytics dashboard
