# Phase 2 Integration Testing Guide

## Quick Start

### 1. Voice to Task Flow
**Expected**: Record voice → Extract task → View in inbox → Convert to task

**Steps**:
1. Click floating + button → Select Mic
2. Click "Start Recording", speak: "I need to finish the project proposal by Friday and schedule team meeting"
3. Click "Stop Recording"
4. Review transcript (auto-transcribed to demo text)
5. Click "Extract Task"
6. Go to Inbox - item shows as PENDING with extracted title/priority
7. Click "Convert" → Creates new task in task list

**Success Criteria**:
- ✓ Transcript captured and editable
- ✓ AI extracted title, priority, deadline
- ✓ Inbox item shows extracted data preview
- ✓ Converting creates task with correct fields
- ✓ Task appears in /tasks list

---

### 2. Image to Task Flow
**Expected**: Capture/upload image → Extract content → Convert to task

**Steps**:
1. Click floating + button → Select Camera
2. Upload image or take photo (whiteboard/notes)
3. System shows image type selector (default: IMAGE)
4. Change to WHITEBOARD to boost confidence score
5. Click "Extract"
6. Extracted data shows in preview (mock: "Review whiteboard notes")
7. Go to Inbox → Accept, then Convert

**Success Criteria**:
- ✓ Image preview displays correctly
- ✓ Confidence score increases for WHITEBOARD type
- ✓ Extracted action items appear
- ✓ Task created with extracted content

---

### 3. Text Form to Task Flow
**Expected**: Use form UI → Create task with all fields → Task appears in list

**Steps**:
1. Click floating + button → Select Document/File icon
2. Fill form:
   - Title: "Complete Q4 planning"
   - Priority: HIGH
   - Deadline: 2026-09-15
   - Est. Time: 120 minutes
   - Project: Select one
   - Tags: "planning,urgent"
3. Click "Save Task"
4. Task appears in /tasks list with correct priority badge
5. Click task → View detail page with all fields

**Success Criteria**:
- ✓ Form validates required fields
- ✓ Task saves with correct data
- ✓ Priority badge displays correct color
- ✓ Deadline shows on task card
- ✓ Detail page shows all fields including tags

---

### 4. Task Details & Editing
**Expected**: View full task info → Edit fields → Changes persist

**Steps**:
1. Click any task in /tasks list
2. Task detail page opens showing:
   - Full title, description
   - Priority, status, deadline
   - Estimated/actual time
   - Tags, project association
   - Dependencies (if any)
3. Click "Edit" (pencil icon)
4. TaskForm modal opens with current values
5. Change: Priority to CRITICAL, Deadline +1 day
6. Click "Save Task"
7. Detail page updates with new values
8. Go back to /tasks - card shows updated priority color

**Success Criteria**:
- ✓ All task fields display on detail page
- ✓ Edit form pre-populates with current data
- ✓ Changes persist after save
- ✓ UI updates reflect new values immediately
- ✓ Back button returns to list

---

### 5. Project Management
**Expected**: View projects → See project progress → Edit, delete, add tasks

**Steps**:
1. Go to /projects page
2. Click on any project card
3. Project detail page shows:
   - Project name, description, color dot
   - Progress bar with percentage
   - Stats: completed, in-progress, total tasks
   - List of all project tasks
4. Click "New Task" button
   - TaskForm opens pre-filled with projectId
   - Create task with all fields
   - Task appears in project task list
5. Modify project name (Edit button)
6. Delete project (Trash button) - confirms deletion

**Success Criteria**:
- ✓ Projects list displays all projects
- ✓ Progress calculation is accurate (completed/total %)
- ✓ Tasks assigned to project show on detail page
- ✓ Creating task auto-assigns to project
- ✓ Edit/delete operations work
- ✓ Navigation back to projects list works

---

### 6. Inbox Workflow
**Expected**: Multiple inbox items → Filter by status → Accept/reject/convert

**Steps**:
1. From capture flows (steps 1-2 above), create 3 inbox items:
   - 1 voice recording
   - 1 image upload
   - Direct text entry
2. Go to /inbox page
3. See items grouped by status:
   - PENDING (all 3 items)
   - ACCEPTED (count shows 0)
   - REJECTED (count shows 0)
   - CONVERTED (count shows 0)
4. Click first item's "Accept" → Status changes to ACCEPTED, moves to ACCEPTED section
5. Click second item's "Reject" → Status changes to REJECTED, moves to REJECTED section
6. Click third item's "Convert" → Creates task, status changes to CONVERTED
7. Verify task exists in /tasks list with converted data

**Success Criteria**:
- ✓ Items display with type/source badges
- ✓ Extracted data preview shows (title, description, priority)
- ✓ Confidence score displays as progress bar
- ✓ Accept/Reject/Convert buttons update status
- ✓ Items reorganize by status section
- ✓ Converted task appears in tasks list

---

### 7. Priority Visualization
**Expected**: Tasks sorted/displayed by priority → Visual indicators

**Steps**:
1. Create tasks with different priorities:
   - Title: "Critical bug", Priority: CRITICAL
   - Title: "Important feature", Priority: HIGH
   - Title: "Nice to have", Priority: LOW
2. Go to /tasks page
3. Right sidebar shows "Tasks by Priority" chart:
   - Shows count for CRITICAL/HIGH, MEDIUM, LOW
   - Color-coded indicators (red, yellow, green)
4. Apply filter "All" - see all tasks
5. Task cards show priority badge with correct color:
   - CRITICAL: Red
   - HIGH: Orange
   - MEDIUM: Yellow
   - LOW: Green
6. Go to Home page - "Urgent tasks" section shows HIGH/CRITICAL only

**Success Criteria**:
- ✓ Priority chart displays on /tasks page
- ✓ Counts are accurate
- ✓ Task cards show correct color badges
- ✓ Home page filters urgent tasks correctly
- ✓ Visual colors match design system

---

### 8. AI Assistant Features
**Expected**: Get recommendations → Daily plan generation → Chat interface

**Steps**:
1. Go to /home page
2. See "AI Recommendation" card showing:
   - "Based on 3 overdue tasks and 2 critical items, prioritize..."
   - Smart suggestion for what to work on next
3. Click "AI" nav button → Go to /ai page
4. Chat interface shows:
   - Previous messages (if any)
   - Input field with Send button
5. Send message: "What should I focus on today?"
   - Response: Smart prioritization based on user tasks
6. Send: "Generate my daily plan"
   - Response: Suggested schedule with time blocks

**Success Criteria**:
- ✓ Home page shows AI recommendation card
- ✓ Recommendation text is contextual
- ✓ AI chat interface responsive
- ✓ Chat history persists in session
- ✓ Responses reflect user's actual tasks

---

### 9. Authentication Flow
**Expected**: Register → Login → Logout → Redirect to login

**Steps**:
1. Go to `/login` page (should be empty workspace)
2. Try login with wrong password → Error message
3. Click "Create account" → Navigate to `/register`
4. Fill form:
   - Name: "Test User"
   - Email: "test@example.com"
   - Password: "SecurePass123!"
5. Click "Register" → Redirect to home (authenticated)
6. Go to `/profile` page → Sees "Test User, test@example.com"
7. Click "Logout" → Redirect to `/login`
8. Try to access `/tasks` without login → Redirect to `/login`

**Success Criteria**:
- ✓ Registration creates user account
- ✓ Login validates credentials correctly
- ✓ Auth token stored in localStorage
- ✓ Protected routes require auth
- ✓ Logout clears token and redirects
- ✓ Token refresh on 401 response

---

### 10. Token Refresh & Error Handling
**Expected**: Session lasts 15min access token + 7 day refresh token

**Steps**:
1. Login successfully
2. Make multiple API calls (creates/updates tasks)
3. Wait > 15 minutes (or mock token expiry)
4. Make next API call → Should auto-refresh token
5. Request succeeds without re-login

**API Error Scenarios**:
1. Create task with missing title → 400 error, form shows validation error
2. Delete task without auth → 401 error, redirect to login
3. Network error → Toast shows "Network error, please try again"
4. Server error (500) → User sees "Something went wrong" message

**Success Criteria**:
- ✓ Token auto-refresh prevents logout
- ✓ Validation errors caught on client + server
- ✓ Unauthorized requests redirect to login
- ✓ Error messages are user-friendly
- ✓ Forms don't submit if validation fails

---

## Regression Checklist

### Core Features
- [ ] Login/Register/Logout flows
- [ ] Create task via form
- [ ] Create task via voice capture
- [ ] Create task via image capture
- [ ] Update task (edit all fields)
- [ ] Complete task
- [ ] Delete task
- [ ] Filter tasks by status
- [ ] Search tasks by title/description
- [ ] View task details with all fields

### Project Management
- [ ] Create project
- [ ] View project detail page
- [ ] View project progress bar
- [ ] Add task to project
- [ ] Edit project
- [ ] Delete project

### Inbox & Capture
- [ ] Voice capture creates inbox item
- [ ] Image capture creates inbox item
- [ ] Inbox shows extracted data
- [ ] Accept/Reject inbox items
- [ ] Convert inbox item to task
- [ ] Inbox groups by status
- [ ] Confidence score displays

### UI/UX
- [ ] Mobile responsive (test on 360px width)
- [ ] Bottom navigation works on mobile
- [ ] Floating action menu opens/closes
- [ ] Modal dialogs are dismissible
- [ ] Forms validate before submit
- [ ] Loading states show spinner
- [ ] Empty states have helpful messaging
- [ ] Color coding matches design system

### Performance
- [ ] Home page loads < 2s
- [ ] Tasks list loads with 50 items smoothly
- [ ] No console errors or warnings
- [ ] Images load correctly
- [ ] Animations smooth (60fps)

---

## Known Test Data

### Demo Credentials
- Email: `demo@example.com`
- Password: `demo123`

### Seed Data
- 2 Projects: "Q4 Planning", "Mobile App"
- 3 Sample Tasks with dependencies
- 2 Reminders set for tomorrow

---

## Manual Testing Notes

1. **Clear localStorage before testing auth flows**:
   ```js
   localStorage.clear()
   ```

2. **Mock API responses in browser DevTools** for offline testing

3. **Test on actual mobile device** for true responsive experience

4. **Check accessibility**:
   - Tab navigation works
   - Form labels associated with inputs
   - Color not sole indicator (use text + icons)
   - Alt text on images

5. **Performance profiling**:
   - Open DevTools Performance tab
   - Record user flow
   - Analyze long tasks > 50ms

---

## Success Criteria Summary

✅ All capture methods (voice/image/text) → inbox → task conversion work
✅ Task CRUD operations (Create/Read/Update/Delete) complete
✅ Project management with progress tracking
✅ Inbox workflow with status transitions
✅ Priority visualization and filtering
✅ Mobile-responsive design on 360px+ screens
✅ Auth with token refresh and error handling
✅ No blocking bugs or console errors
✅ AI features provide contextual recommendations
✅ All routes navigate correctly with proper guards

**Phase 2 is complete when all tests pass ✓**
