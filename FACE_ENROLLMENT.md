# Face Enrollment Guide for Klingi

## How to Register/Enroll Faces

Face enrollment allows you to register people so the system can automatically recognize them and unlock the door.

---

## Step-by-Step Enrollment

### 1. Open Settings
- Open the Klingi app
- Tap the **⚙️ Settings** tab at the bottom

### 2. Find "Enroll New Face" Section
You should see a highlighted blue section with:
- 📸 Enroll New Face
- Text input field
- "Capture & Enroll" button

### 3. Enter Person's Name
Type the name of the person you're enrolling:
- Example: "Ameer"
- Example: "Mom"
- Example: "John"

### 4. Position for Camera
1. **Stand directly in front of the camera**
2. Look **straight at the camera**
3. **Good lighting** is important (avoid backlighting)
4. Face should be centered and clearly visible

### 5. Start Enrollment
Tap **"Capture & Enroll"** button

You'll see:
- ✅ "Accessing microphone..." → ignore this (it checks for audio)
- ⏳ "Starting enrollment..."
- 🎥 "Liveness check: please blink naturally or move your head slightly"

### 6. Liveness Detection (Blink & Movement)
The system captures 8 frames and checks for:
- **Blinking** (eyes closing and opening)
- **Head movement** (slight tilt or nod)

**Do this:**
- ✅ Blink naturally several times
- ✅ Slightly nod your head
- ✅ Move face left and right a little
- ✅ Maintain good lighting

**Avoid:**
- ❌ Perfect stillness (looks like a photo)
- ❌ Extreme head movements
- ❌ Poor lighting or shadows on face

### 7. Enrollment Complete
If successful:
- ✅ "Face enrolled: Ameer"
- Face appears in "👥 Enrolled Faces" list
- You can now use auto-unlock!

If it fails:
- ❌ "Liveness check failed. Try again."
- Try again with more movement

---

## View Enrolled Faces

### In Settings Tab
Scroll down to **"👥 Enrolled Faces"** section:
- Lists all enrolled people
- Shows name
- Delete button for each

### Refresh List
Tap **"Refresh"** button to reload the list

### Delete a Face
1. Find person's name in the list
2. Tap **"Delete"** button next to their name
3. Confirm deletion
4. Face is removed from system

---

## Testing Recognition

### Automatic Recognition
1. Stand in front of camera on Home page
2. Wait for face tracking (green box appears)
3. If you're enrolled:
   - ✅ Green banner shows your name
   - ✅ Door auto-unlocks
   - 🔓 "Auto-unlock granted: [Name]" in Activity

### Manual Recognition
On Devices tab:
1. Tap **"🔍 Recognize"** button
2. Face recognition runs
3. Shows result (granted or denied)

---

## Tips for Best Results

### Lighting
- Use **daylight** or bright indoor lighting
- Avoid **backlighting** (light behind your head)
- Avoid **shadows** on face
- **Front-facing** light is best

### Camera Position
- Camera should be at **eye level**
- Stand **1-2 feet** from camera
- Face should be **fully in frame**
- No glasses or hats covering eyes

### During Enrollment
- **Blink naturally** 3-4 times
- **Nod** your head slowly
- **Turn** head slightly left/right
- **Maintain distance** - don't get too close

### Multiple Angles (Optional)
For better accuracy, enroll same person from:
- Straight on
- Slightly left angle
- Slightly right angle
- Different lighting

But system works with just one enrollment.

---

## Troubleshooting

### "Liveness check failed"
**Problem:** System didn't detect blinking or movement

**Solutions:**
1. Blink more obviously (3-4 times)
2. Move head more (nod up/down)
3. Check lighting (too dark?)
4. Make sure face is fully visible
5. Try again

### "No face detected"
**Problem:** Camera can't see your face

**Solutions:**
1. Move closer to camera
2. Make sure you're looking at camera
3. Check lighting
4. Verify camera is working (check Home page)
5. Try in different location

### "Face not recognized"
**Problem:** Enrolled face, but system doesn't recognize you

**Solutions:**
1. Different lighting than enrollment
2. Face angle different
3. Wearing glasses/hat (wasn't when enrolled)
4. Delete and re-enroll
5. Try enrolling from multiple angles

### "Camera not working"
**Problem:** No video feed on Home page

**Solutions:**
1. Check camera is connected
2. Check no other app is using camera
3. Give browser camera permission
4. Try different camera (if multiple available)
5. Restart browser

---

## Advanced: Multiple Enrollments of Same Person

For even better recognition accuracy, enroll the same person multiple times from different angles:

1. **Enrollment 1:** "Ameer - Front"
2. **Enrollment 2:** "Ameer - Left"
3. **Enrollment 3:** "Ameer - Right"

System will recognize any angle. But delete oldest if you have space limits.

---

## Activity Log

Check **Activity** tab to see:
- ✅ "Face recognized: Ameer"
- ✅ "Auto-unlock granted: Ameer"
- ✅ "Face enrolled: Ameer"
- ❌ "Unknown face detected"
- 📭 All other door events

---

## Security Notes

**Auto-Unlock is triggered when:**
- Known face detected in camera feed
- OR manual "Recognize" button tapped
- AND face recognition matches enrolled face

**Auto-Unlock does NOT happen for:**
- Strangers (unknown faces)
- Photos of enrolled people
- Extremely poor lighting

**Liveness detection prevents:**
- Photo spoofing (showing a picture)
- Video replay attacks

---

## Quick Checklist ✓

Before enrolling:
- ✅ Good lighting
- ✅ Camera working (test on Home page)
- ✅ Position yourself well
- ✅ Have name ready

During enrollment:
- ✅ Look at camera
- ✅ Blink naturally
- ✅ Nod head
- ✅ Don't move too much
- ✅ Stay at good distance

After enrollment:
- ✅ See success message
- ✅ Name appears in list
- ✅ Test recognition
- ✅ Auto-unlock works

---

## Still Having Issues?

1. **Check troubleshooting above**
2. **Check HTTPS_SETUP.md** for camera/microphone issues
3. **Check Activity tab** for error messages
4. **Restart browser** (Ctrl+Shift+R to hard refresh)
5. **Check backend logs** for detailed errors

---

**Ready to enroll! Your smart doorbell will recognize you. 👤✅**
