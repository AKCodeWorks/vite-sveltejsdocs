<script lang="ts">
	/**
	 * @auto-doc
	 * @title Create User
	 * @group API Examples/Users
	 * @author iatrophobic
	 * @description Create a new user account with an email address and profile payload.
	 * Requires bearer authentication and returns the created record plus onboarding metadata.
	 * @route POST /api/users
	 * @status 201 Created
	 * @auth Bearer token
	 * @param email Email address for the new user.
	 * @param profile Display name, age, and profile metadata to persist.
	 * @returns {yeet: string, age: number}
	 * @method POST
	 * @headers {"Authorization": "Bearer <token>", "x-api-key": "somekey", "Content-Type": "application/json"}
	 * @body {"email": "ada@example.com", "profile": {"displayName": "Ada", "age": 32, "marketingOptIn": false}}
	 * @response {"id": "usr_123", "email": "ada@example.com", "profile": {"displayName": "Ada", "age": 32}, "createdAt": "2026-04-16T12:00:00.000Z"}
	 * @example cURL
	 * curl -X POST https://api.example.com/users \
	 *   -H "Authorization: Bearer <token>" \
	 *   -H "x-api-key: somekey" \
	 *   -H "Content-Type: application/json" \
	 *   -d '{"email":"ada@example.com","profile":{"displayName":"Ada","age":32}}'
	 * @example JavaScript
	 * const response = await fetch('https://api.example.com/users', {
	 *   method: 'POST',
	 *   headers: {
	 *     Authorization: 'Bearer <token>',
	 *     'x-api-key': 'somekey',
	 *     'Content-Type': 'application/json'
	 *   },
	 *   body: JSON.stringify({
	 *     email: 'ada@example.com',
	 *     profile: { displayName: 'Ada', age: 32 }
	 *   })
	 * });
	 *
	 * const data = await response.json();
	 */

	/**
	 * @auto-doc
	 * @title Get User
	 * @method GET
	 * @group API Examples/Users
	 * @description Fetch a single user by id and optionally expand related teams.
	 * Useful for profile pages and admin tools that need the latest persisted state.
	 * @route GET /api/users/:userId
	 * @status 200 OK
	 * @auth Bearer token
	 * @param userId Unique identifier for the user.
	 * @param includeTeams Set to true to include related team membership data.
	 * @fetchUrl https://api.example.com/users/{userId}?includeTeams=true
	 * @headers {"Authorization": "Bearer <token>"}
	 * @response {"id": "usr_123", "email": "ada@example.com", "profile": {"displayName": "Ada"}, "teams": [{"id": "team_1", "name": "Core Platform"}]}
	 * @example Request URL
	 * GET /api/users/usr_123?includeTeams=true
	 */

	/**
	 * @auto-doc
	 * @title Delete User
	 * @method DELETE
	 * @group API Examples/Users
	 * @description Permanently delete a user account.
	 * Use this only for hard-delete workflows after a confirmation step.
	 * @route DELETE /api/users/:userId
	 * @status 204 No Content
	 * @auth Bearer token
	 * @param userId Unique identifier for the user being removed.
	 * @headers {"Authorization": "Bearer <token>"}
	 * @example cURL
	 * curl -X DELETE https://api.example.com/users/usr_123 \
	 *   -H "Authorization: Bearer <token>"
	 */

	/**
	 * @auto-doc
	 * @title Replace User Profile
	 * @method PUT
	 * @group API Examples/Users
	 * @description Replace the full editable profile document for an existing user.
	 * Send the complete profile object when performing a full replacement.
	 * @route PUT /api/users/:userId/profile
	 * @status 200 OK
	 * @auth Bearer token
	 * @param userId Unique identifier for the user.
	 * @body {"displayName": "Ada Lovelace", "age": 33, "timezone": "UTC", "bio": "Writes analytical engines for fun."}
	 * @response {"id": "usr_123", "profile": {"displayName": "Ada Lovelace", "age": 33, "timezone": "UTC", "bio": "Writes analytical engines for fun."}}
	 * @example JSON payload
	 * {
	 *   "displayName": "Ada Lovelace",
	 *   "age": 33,
	 *   "timezone": "UTC",
	 *   "bio": "Writes analytical engines for fun."
	 * }
	 */

	/**
	 * @auto-doc
	 * @title Update User Status
	 * @method PATCH
	 * @group API Examples/Users
	 * @description Apply a partial update to account status without resending the full profile.
	 * This is useful for moderation, onboarding, and support tooling.
	 * @route PATCH /api/tenants/:tenantId/users/:userId/status
	 * @status 200 OK
	 * @auth Bearer token
	 * @param tenantId Unique identifier for the tenant.
	 * @param userId Unique identifier for the user.
	 * @fetchUrl https://api.example.com/{tenantId}/users/{userId}/status
	 * @body {"status": "suspended", "reason": "chargeback"}
	 * @response {"id": "usr_123", "status": "suspended", "reason": "chargeback", "updatedAt": "2026-04-16T12:05:00.000Z"}
	 * @example JavaScript
	 * await fetch('https://api.example.com/acme/users/usr_123/status', {
	 *   method: 'PATCH',
	 *   headers: {
	 *     Authorization: 'Bearer <token>',
	 *     'Content-Type': 'application/json'
	 *   },
	 *   body: JSON.stringify({
	 *     status: 'suspended',
	 *     reason: 'chargeback'
	 *   })
	 * });
	 */
</script>

<h1>Welcome to your library project</h1>
<p>Create your package using @sveltejs/package and preview/showcase your work with SvelteKit</p>
<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>
