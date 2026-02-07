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

	// Step 2: Sign in to get session
	let session = authData.session;
	if (!session) {
		const { data: signInData, error: signInError } =
			await supabase.auth.signInWithPassword({
				email: payload.email,
				password: payload.password,
			});
		if (signInError) {
			throw new Error(signInError.message);
		}
		session = signInData.session;
	}

	const accessToken = session?.access_token;
	if (!accessToken) {
		throw new Error("Unable to retrieve session token");
	}

	// Step 3: Create organization
	const { data: orgData, error: orgError } = await supabase
		.from("organizations")
		.insert({
			name: payload.businessName,
			created_by: authUser.id,
		})
		.select()
		.single();

	if (orgError) {
		throw new Error("Failed to create organization: " + orgError.message);
	}

	// Step 4: Update profile - set as admin and link to organization
	const { error: profileError } = await supabase
		.from("profiles")
		.update({
			full_name: payload.fullName,
			email: payload.email,
			role: "admin",
			org_id: orgData.id,
			branch_id: null,
		})
		.eq("id", authUser.id);

	if (profileError) {
		throw new Error("Failed to update profile: " + profileError.message);
	}

	return accessToken;
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