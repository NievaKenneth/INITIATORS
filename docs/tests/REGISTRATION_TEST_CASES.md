# QA Test Suite: User Registration Module

## TC-REG-01: Successful User Signup
- *Description:* Verify new user can register with valid credentials.
- *Steps:* Navigate to register.html, input valid email and password, click Register.
- *Expected Result:* Form prevents default submit, calls Supabase Auth, and creates user.
- *Actual Result:* Form executes native HTML POST, resulting in HTTP 405 Method Not Allowed.
- *Status:* FAILED (Blocked by missing e.preventDefault()).

## TC-REG-02: Empty Field Validation
- *Steps:* Leave email/password empty and click Submit.
- *Expected Result:* Client-side error messages appear below inputs.
- *Status:* PASSED. 
