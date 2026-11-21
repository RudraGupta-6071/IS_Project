# IIT Kharagpur course and professor reviews

KGP Coursebook is a responsive Next.js app for IIT Kharagpur course and professor reviews. It includes a Postgres-backed catalog, API, and Supabase email-code sign-in.

## Run locally

From this folder, with Node.js 22+, npm, and Docker running:

~~~powershell
npm install
npx supabase start
Copy-Item .env.example .env.local
~~~

Keep APP_ORIGIN=http://localhost:3000 for the example below. Use the publishable or anon key printed by `npx supabase status` as `SUPABASE_PUBLIC_KEY` in `.env.local`. The example already includes the local database and Auth URLs. Start the API with `npm run dev`. A fresh local Supabase stack applies the migrations and loads the fictional catalog and demo allowlist. On an existing local stack, `npx supabase migration up --local` applies pending migrations. If you want to recreate the local database and reload the seed, `npx supabase db reset` discards existing local data.

## Browse in the app

Open http://localhost:3000 after starting the application. Sign in with a demo address from the local seed and copy its one-time code from the mail inbox at http://127.0.0.1:54324. The home page offers separate search modes. The course and professor directories preserve filters in the URL and show aggregate ratings and review counts. Open a record to see its teaching assignments, rating breakdowns, project types where available, and student reviews. Choose **Write a review** from a record to start with that course or professor selected.

The overall score averages each review's non-workload ratings and then averages those review scores. Workload remains visible as its own light-to-heavy measure. Directory aggregates use the selected academic term and review context where applicable. Detail aggregates cover the selected academic term or all terms. Numeric averages and each rating breakdown require at least three applicable visible responses. Missing ratings are left out.

### Sign in and submit a demo review

~~~powershell
$base = 'http://localhost:3000/api'
$email = 'reviewer1@students.example.test'
$origin = @{Origin='http://localhost:3000'}
Invoke-RestMethod "$base/auth/otp" -Headers $origin -Method Post -ContentType 'application/json' -Body (@{email=$email} | ConvertTo-Json)
$code = Read-Host 'Enter the code from http://127.0.0.1:54324'
Invoke-RestMethod "$base/auth/verify" -Headers $origin -SessionVariable studentSession -Method Post -ContentType 'application/json' -Body (@{email=$email;code=$code} | ConvertTo-Json)
Invoke-RestMethod "$base/auth/session" -WebSession $studentSession
$course = (Invoke-RestMethod "$base/courses?type=regular" -WebSession $studentSession).items[0]
$detail = Invoke-RestMethod "$base/courses/$($course.id)" -WebSession $studentSession
$assignment = $detail.assignments[0]
$review = @{
    assignmentId = $assignment.id
    professorId = $assignment.professor_id
    termId = $assignment.term_id
    context = 'teaching'
    ratings = @{teachingQuality=5;subjectKnowledge=5;grading=4;regularity=5;approachability=4;workload=3}
    feedback = 'The examples made the lectures easier to follow.'
}
$created = Invoke-RestMethod "$base/reviews" -Method Post -Headers $origin -WebSession $studentSession -ContentType 'application/json' -Body ($review | ConvertTo-Json)
Invoke-RestMethod "$base/reviews?courseId=$($course.id)" -WebSession $studentSession
~~~

Repeating the same submission should return 409. A write from another origin should return 403. The second demo account, `reviewer2@students.example.test`, can read the review and should receive a 404 if it tries to edit or delete it. The same listing without credentials should return 401. The review response should contain the review ID, catalog IDs, term, ratings, and feedback without an author ID, email, or name.

## Endpoints

All catalog and review endpoints require the browser session cookie. Same-origin browser requests send it automatically. POST, PATCH, and DELETE require the exact configured `Origin` header. This API now uses a revocable cookie session in place of the earlier bearer-token and refresh contract. List endpoints return `items` and `nextOffset`. Pass the returned offset to request the next page. Page size defaults to 25 and is capped at 100.

| Method | Path | Inputs |
| --- | --- | --- |
| POST | /api/auth/otp | `email`. Acknowledges the request even if the address is ineligible. |
| POST | /api/auth/verify | `email` and the six-digit string `code`. Creates an app session and sets the HttpOnly cookie. |
| GET | /api/auth/session | Confirms the current session, or returns 401. |
| POST | /api/auth/logout | Revokes the current app session and clears the cookie. |
| GET | /api/catalog | Departments and academic terms. |
| GET | /api/courses | `q`, `departmentId`, `termId`, `type`, `limit`, `offset`. |
| GET | /api/professors | `q`, `departmentId`, `termId`, review `context`, `limit`, `offset`. |
| GET | /api/courses/{id} | Course details and teaching assignments. |
| GET | /api/professors/{id} | Professor details and teaching assignments. |
| GET | /api/reviews | `courseId`, `professorId`, `termId`, `context`, `limit`, `offset`. |
| GET | /api/reviews/mine | Same filters, scoped to the signed-in student's reviews. |
| POST | /api/reviews | Target, context, ratings and optional feedback. Returns review ID. |
| PATCH | /api/reviews/{id} | Context, complete ratings and optional feedback, plus applicable project types and topics. The supplied context must match the original. Returns review ID. |
| DELETE | /api/reviews/{id} | Delete an owned review. Returns 204. |

For an independent supervision review, send `context: "project"` and ratings `topicFreedom`, `guidance`, `involvement`, `workload`, `evaluation`, and `grading`. Include one to eight distinct `projectTypes`, for example `["Simulation", "Literature review"]`. Omit `assignmentId` for independent professor supervision. All ratings are integers from 1 to 5. Workload uses 1 for light and 5 for heavy. Feedback is limited to 3,000 characters. PATCH replaces the editable content, so an omitted feedback value clears it. Keep identifying information out of feedback, project types, and topics. Display all student-entered text as plain text.

## Schema

- Departments own course and professor catalog records. Course codes are unique. Stable professor catalog keys support repeat imports while permitting professors with identical names.
- Each course has one offering per academic term. A teaching assignment connects a professor to that offering. Multiple professors can teach the same offering.
- Each academic term has a year and semester. Autumn 2026 and spring 2027 both have academic start year 2026. New terms can be added as rows.
- Foreign keys enforce consistent course, professor and term combinations. Unique indexes prevent simultaneous duplicate reviews. Each student can review the same course, professor, and term once across both contexts, and can update that review through PATCH. Independent project reviews have their own one-per-professor-and-term constraint. The migration detects any conflicting existing rows and stops without deleting them.
- Supabase Auth stores accounts. The private review table retains the account UUID for ownership. The API uses a separate read view with an explicit list of displayed fields. Eligibility is checked on protected requests. Course participation and project supervision are self-reported.
- Review lists are paginated, and indexes cover term, assignment, professor, author, and recency. Catalog text search uses case-insensitive substring matching.

## Hosted setup

Apply all migrations to the intended Supabase project. Set APP_ORIGIN to the exact HTTPS origin of the app, without a trailing slash. Configure email delivery, enable email confirmation, install the OTP templates for confirmation and magic-link sign-in, and enable the Before User Created hook at `public.check_student_signup`. Add confirmed student domains to `review_app.student_domains`. For any domain shared with staff or alumni, keep `require_allowlist` enabled and add verified student addresses to `review_app.approved_emails`. The demo seed contains fictional records for local use.

Use a dedicated database login with membership in `review_app_api` for the hosted `DATABASE_URL`. Provision the login using your database administration workflow and supply the connection string as a server environment variable. The example local connection uses the standard development database account.


## What student sign-in verifies

- Supabase verifies a one-time code delivered to the exact institute email address. The application also requires that the current confirmed email belongs to an approved domain and, where configured, is on the operator's verified student allowlist. Email verification proves mailbox control. Student status depends on the domain policy or the eligibility records maintained by the operator.
- Supabase Auth stores the email and account UUID. The app stores approved email addresses where manual eligibility is required, a SHA-256 digest of a random session token with its account UUID and expiry, and the account UUID on the private review record. The application does not request a student ID or student name. Supabase credentials from OTP verification stay on the server and are not persisted by the app.
- The browser holds an opaque session cookie valid for at most 12 hours. It is HttpOnly and SameSite=Lax, with Secure and a host-only cookie name on HTTPS. Logout deletes the stored digest. Each protected request also checks current eligibility and account status.
- Review reads and the session-status response omit account UUIDs, emails, student IDs, and student names. Free-text comments and project labels are authored by students. Keep identifying details out of those fields.
- Periodically remove expired rows from review_app.student_sessions with a privileged maintenance job. Revocation of an individual account's app sessions can also be done by deleting its corresponding rows.

## Review submission and editing

Select an assignment to link the course, professor, semester and academic year. Regular courses have six required star ratings. Project-based course reviews include those six ratings plus six project ratings, project types, and a short topic description. Written feedback is optional. Independent project supervision is still available from professor profiles and has its own project ratings.

For a project-based course, POST with context `project`, an assignment ID, professor ID and term ID, the six regular rating keys, and `topicFreedom`, `guidance`, `involvement`, `projectWorkload`, `evaluation`, and `projectGrading`. Include `projectTypes` and `projectTopics`. Independent supervision uses `workload` and `grading` in its project rating set and requires no assignment or topic description.

**My reviews** links to the owner-only editor. It loads the existing review via `GET /api/reviews/mine/{id}` and changes the content via `PATCH /api/reviews/{id}`. The original assignment, professor, and term stay fixed. Older project-course reviews are retained. When a student edits an older project-course review, the form asks for the newly required fields. Public review responses include review content and academic metadata only.

## Reporting, moderation, and demo data

Signed-in eligible students can report a review for abuse, personal information, spam, or another concern. A student can have one open report per review. Moderators sign in through the same verified email flow. Grant access from a trusted database console using the current verified account UUID:

```sql
insert into review_app.moderators (student_id)
values ('<verified-auth-user-uuid>'::uuid);
```

Moderators use **Moderation** to hide a reported review, dismiss its reports, or restore a hidden review. Each decision is audited. Hidden reviews are omitted from student-facing lists, averages and breakdowns. Authors can still edit their hidden reviews, which remain hidden until restored. Public review payloads omit the author account linkage. Moderator queues omit both author and reporter account identifiers.

User-entered text is normalized, trimmed, length-checked and displayed as plain text. Email addresses and common roll-number formats are rejected. Students should omit names and other identifying details, which can be reported for moderation.

The seed inserts fictional catalog entries and student allowlist addresses for local development, with no invented reviews. Records from the reserved DEMO department and their test reviews are labeled in the app. Keep those records out of production. Directory and detail pages support academic-term filters. Semester and academic year remain attached to every review even when the view covers multiple years.
