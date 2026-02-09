import { supabase } from "@/lib/supabase";

export type RegisterBusinessPayload = {
	businessName: string;
	email: string;
	password: string;
	fullName: string;
};

export type LoginUserPayload = {
	email: string;
	password: string;
};

// Helper function to wait for profile to exist
async function waitForProfile(userId: string, maxAttempts = 10): Promise<boolean> {
	for (let i = 0; i < maxAttempts; i++) {
		const { data } = await supabase
			.from("profiles")
			.select("id")
			.eq("id", userId)
			.single();
		
		if (data) {
			return true;
		}
		
		// Wait 500ms before trying again
		await new Promise(resolve => setTimeout(resolve, 500));
	}
	return false;
}

export async function registerBusiness(
	payload: RegisterBusinessPayload
): Promise<string> {
	// Step 1: Create auth user
	const { data: authData, error: authError } = await supabase.auth.signUp({
		email: payload.email,
		password: payload.password,
	});

	if (authError) {
		throw new Error(authError.message);
	}

	const authUser = authData.user;
	if (!authUser) {
		throw new Error("Unable to create auth user");
	}

	// Step 2: Wait for profile to be created by database trigger
	const profileExists = await waitForProfile(authUser.id);
	if (!profileExists) {
		throw new Error("Profile creation timed out. Please try again.");
	}

	// Step 3: Call the database function to set up the business
	// This bypasses RLS because it uses SECURITY DEFINER
	const { data: orgId, error: setupError } = await supabase.rpc('setup_new_business', {
		user_id: authUser.id,
		business_name: payload.businessName,
		full_name: payload.fullName,
		user_email: payload.email,
	});

	if (setupError) {
		console.error("Setup error:", setupError);
		throw new Error("Failed to set up business: " + setupError.message);
	}

	console.log("Business created with org_id:", orgId);

	// Step 4: Return message about email confirmation
	// User needs to confirm email before they can sign in
	throw new Error("Account created successfully! Please check your email to confirm your account, then sign in.");
}

export async function loginUser(payload: LoginUserPayload): Promise<string> {
	const { data, error } = await supabase.auth.signInWithPassword({
		email: payload.email,
		password: payload.password,
	});

	if (error) {
		throw new Error(error.message);
	}

	const accessToken = data.session?.access_token;
	if (!accessToken) {
		throw new Error("Unable to retrieve session token");
	}

	return accessToken;
}