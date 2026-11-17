import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VALID_PERMISSIONS = [
  "dashboard.view",
  "products.view",
  "products.view_prices",
  "products.create",
  "products.edit",
  "products.edit_images",
  "products.edit_price",
  "products.edit_stock",
  "products.toggle_visibility",
  "products.bulk_edit",
  "products.delete",
  "categories.view",
  "categories.create_edit",
  "categories.reorder",
  "categories.toggle_visibility",
  "categories.delete",
  "resellers.view",
  "resellers.create",
  "resellers.edit",
  "resellers.reset_password",
  "resellers.suspend",
  "resellers.delete",
  "orders.view",
  "orders.update_status",
  "orders.export",
  "settings.view",
  "settings.edit",
] as const;

const PermissionEnum = z.enum(VALID_PERMISSIONS);

const CreateResellerSchema = z.object({
  action: z.literal("create_reseller"),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, hyphens, and underscores"),
  email: z.string().email("Valid email address is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  full_name: z.string().min(2, "Full name is required"),
  business_name: z.string().min(2, "Business name is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  state: z.string().min(2, "State is required"),
  city: z.string().min(2, "City is required"),
  assigned_staff_id: z.string().uuid().nullable().optional(),
});

const UpdateProfileSchema = z.object({
  action: z.literal("update_profile"),
  user_id: z.string().uuid(),
  email: z.string().email("Valid email address is required").optional(),
  full_name: z.string().min(2),
  business_name: z.string().min(2),
  phone: z.string().min(10),
  state: z.string().min(2),
  city: z.string().min(2),
  assigned_staff_id: z.string().uuid().nullable().optional(),
});

const ResetPasswordSchema = z.object({
  action: z.literal("reset_password"),
  user_id: z.string().uuid(),
  new_password: z.string().min(6, "New password must be at least 6 characters"),
});

const SetStatusSchema = z.object({
  action: z.literal("set_status"),
  user_id: z.string().uuid(),
  status: z.enum(["active", "suspended"]),
});

const DeleteUserSchema = z.object({
  action: z.literal("delete_user"),
  user_id: z.string().uuid(),
});

// Super Admin-only Staff Actions
const CreateStaffSchema = z.object({
  action: z.literal("create_staff"),
  full_name: z.string().min(2, "Full name is required"),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, hyphens, and underscores"),
  phone: z.string().min(10, "Valid phone number is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  permissions: z.array(PermissionEnum),
  category_scope: z.array(z.string().uuid()).nullable().optional(),
  reseller_scope: z.enum(["all", "assigned"]).default("all"),
  preset: z.string().nullable().optional(),
});

const UpdateStaffPermissionsSchema = z.object({
  action: z.literal("update_staff_permissions"),
  user_id: z.string().uuid(),
  full_name: z.string().min(2).optional(),
  phone: z.string().min(10).optional(),
  permissions: z.array(PermissionEnum),
  category_scope: z.array(z.string().uuid()).nullable().optional(),
  reseller_scope: z.enum(["all", "assigned"]),
  preset: z.string().nullable().optional(),
});

const ResetStaffPasswordSchema = z.object({
  action: z.literal("reset_staff_password"),
  user_id: z.string().uuid(),
  new_password: z.string().min(6, "New password must be at least 6 characters"),
});

const SetStaffStatusSchema = z.object({
  action: z.literal("set_staff_status"),
  user_id: z.string().uuid(),
  status: z.enum(["active", "suspended"]),
});

const DeleteStaffSchema = z.object({
  action: z.literal("delete_staff"),
  user_id: z.string().uuid(),
});

const RequestSchema = z.discriminatedUnion("action", [
  CreateResellerSchema,
  UpdateProfileSchema,
  ResetPasswordSchema,
  SetStatusSchema,
  DeleteUserSchema,
  CreateStaffSchema,
  UpdateStaffPermissionsSchema,
  ResetStaffPasswordSchema,
  SetStaffStatusSchema,
  DeleteStaffSchema,
]);

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing Authorization header" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized caller" }, 401);
    }

    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, status, username")
      .eq("id", user.id)
      .single();

    if (profileError || !callerProfile || callerProfile.status !== "active" || !["admin", "staff"].includes(callerProfile.role)) {
      return jsonResponse({ error: "Forbidden: Active administrator privileges required" }, 403);
    }

    const isSuperAdmin = callerProfile.role === "admin";
    let callerPerms: string[] = [];
    let callerResellerScope: "all" | "assigned" = "all";

    if (!isSuperAdmin) {
      const { data: sp } = await supabaseAdmin
        .from("staff_permissions")
        .select("permissions, reseller_scope")
        .eq("user_id", user.id)
        .maybeSingle();

      callerPerms = Array.isArray(sp?.permissions) ? sp.permissions : [];
      callerResellerScope = sp?.reseller_scope === "assigned" ? "assigned" : "all";
    }

    const callerHasPerm = (perm: string) => isSuperAdmin || callerPerms.includes(perm);

    const logActivity = async (action: string, entity: string, entityId: string | null, details: Record<string, unknown>) => {
      await supabaseAdmin.from("admin_activity_log").insert({
        actor_id: user.id,
        action,
        entity,
        entity_id: entityId,
        details,
      });
    };

    const body = await req.json();
    const parseResult = RequestSchema.safeParse(body);
    if (!parseResult.success) {
      return jsonResponse(
        { error: "Validation failed", details: parseResult.error.flatten() },
        400
      );
    }

    const data = parseResult.data;

    // ------------------------------------------------------------------
    // RESELLER ACTIONS (Super Admin OR Staff with matching permission & scope)
    // ------------------------------------------------------------------
    if (data.action === "create_reseller") {
      if (!callerHasPerm("resellers.create")) {
        return jsonResponse({ error: "Forbidden: resellers.create permission required" }, 403);
      }

      const cleanUsername = data.username.toLowerCase().trim();
      const cleanEmail = data.email.toLowerCase().trim();

      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("username", cleanUsername)
        .maybeSingle();
      if (existingProfile) {
        return jsonResponse({ error: "Username already taken" }, 409);
      }

      const { data: existingEmailProfile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", cleanEmail)
        .maybeSingle();
      if (existingEmailProfile) {
        return jsonResponse({ error: "Email address is already registered" }, 409);
      }

      // Auto-assign staff admin when caller is restricted to assigned resellers
      let assignedStaffId: string | null = null;
      if (!isSuperAdmin && callerResellerScope === "assigned") {
        assignedStaffId = user.id;
      } else if (isSuperAdmin) {
        assignedStaffId = data.assigned_staff_id ?? null;
      }

      const { data: newAuthUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: data.password,
        email_confirm: true,
        user_metadata: {
          role: "reseller",
          username: cleanUsername,
          email: cleanEmail,
          full_name: data.full_name,
        },
      });

      if (createAuthError) {
        return jsonResponse({ error: createAuthError.message }, 400);
      }

      const { data: profile, error: insertError } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: newAuthUser.user.id,
          role: "reseller",
          username: cleanUsername,
          email: cleanEmail,
          full_name: data.full_name,
          business_name: data.business_name,
          phone: data.phone,
          state: data.state,
          city: data.city,
          status: "active",
          assigned_staff_id: assignedStaffId,
        })
        .select()
        .single();

      if (insertError) {
        await supabaseAdmin.auth.admin.deleteUser(newAuthUser.user.id);
        return jsonResponse({ error: insertError.message }, 500);
      }

      await logActivity("reseller.create", "reseller", profile.id, {
        username: cleanUsername,
        full_name: data.full_name,
        assigned_staff_id: assignedStaffId,
      });

      return jsonResponse({ success: true, profile });
    }

    const loadTargetResellerAndAuthorize = async (targetId: string, requiredPerm: string) => {
      if (!callerHasPerm(requiredPerm)) {
        return { error: jsonResponse({ error: `Forbidden: ${requiredPerm} permission required` }, 403), target: null };
      }
      const { data: target, error: targetErr } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", targetId)
        .maybeSingle();

      if (targetErr || !target) {
        return { error: jsonResponse({ error: "Reseller account not found" }, 404), target: null };
      }
      if (target.role !== "reseller") {
        return { error: jsonResponse({ error: "Forbidden: Target user is not a reseller" }, 403), target: null };
      }
      if (!isSuperAdmin && callerResellerScope === "assigned" && target.assigned_staff_id !== user.id) {
        return { error: jsonResponse({ error: "Forbidden: This reseller is not assigned to you" }, 403), target: null };
      }
      return { error: null, target };
    };

    if (data.action === "update_profile") {
      const check = await loadTargetResellerAndAuthorize(data.user_id, "resellers.edit");
      if (check.error) return check.error;
      const target = check.target!;

      const profileUpdates: Record<string, string | null> = {
        full_name: data.full_name,
        business_name: data.business_name,
        phone: data.phone,
        state: data.state,
        city: data.city,
      };

      if (isSuperAdmin && data.assigned_staff_id !== undefined) {
        profileUpdates.assigned_staff_id = data.assigned_staff_id;
      }

      if (data.email) {
        const cleanEmail = data.email.toLowerCase().trim();
        const { error: authEmailError } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
          email: cleanEmail,
          email_confirm: true,
        });
        if (authEmailError) {
          return jsonResponse({ error: authEmailError.message }, 400);
        }
        profileUpdates.email = cleanEmail;
      }

      const { data: updated, error: updateError } = await supabaseAdmin
        .from("profiles")
        .update(profileUpdates)
        .eq("id", data.user_id)
        .select()
        .single();

      if (updateError) {
        return jsonResponse({ error: updateError.message }, 400);
      }

      await logActivity("reseller.update", "reseller", data.user_id, {
        username: target.username,
        before: {
          full_name: target.full_name,
          assigned_staff_id: target.assigned_staff_id,
        },
        after: {
          full_name: updated.full_name,
          assigned_staff_id: updated.assigned_staff_id,
        },
      });

      return jsonResponse({ success: true, profile: updated });
    }

    if (data.action === "reset_password") {
      const check = await loadTargetResellerAndAuthorize(data.user_id, "resellers.reset_password");
      if (check.error) return check.error;

      const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
        password: data.new_password,
      });

      if (resetError) {
        return jsonResponse({ error: resetError.message }, 400);
      }

      await logActivity("reseller.reset_password", "reseller", data.user_id, {
        username: check.target!.username,
      });

      return jsonResponse({ success: true, message: "Password updated successfully" });
    }

    if (data.action === "set_status") {
      const check = await loadTargetResellerAndAuthorize(data.user_id, "resellers.suspend");
      if (check.error) return check.error;

      const banDuration = data.status === "suspended" ? "876000h" : "none";
      await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
        ban_duration: banDuration,
      });

      const { data: updated, error: statusError } = await supabaseAdmin
        .from("profiles")
        .update({ status: data.status })
        .eq("id", data.user_id)
        .select()
        .single();

      if (statusError) {
        return jsonResponse({ error: statusError.message }, 400);
      }

      await logActivity("reseller.set_status", "reseller", data.user_id, {
        username: check.target!.username,
        before: { status: check.target!.status },
        after: { status: data.status },
      });

      return jsonResponse({ success: true, profile: updated });
    }

    if (data.action === "delete_user") {
      const check = await loadTargetResellerAndAuthorize(data.user_id, "resellers.delete");
      if (check.error) return check.error;

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
      if (deleteError) {
        return jsonResponse({ error: deleteError.message }, 400);
      }

      await logActivity("reseller.delete", "reseller", data.user_id, {
        username: check.target!.username,
        full_name: check.target!.full_name,
      });

      return jsonResponse({ success: true, message: "User deleted" });
    }

    // ------------------------------------------------------------------
    // STAFF ADMIN ACTIONS (SUPER ADMIN ONLY)
    // ------------------------------------------------------------------
    if (!isSuperAdmin) {
      return jsonResponse({ error: "Forbidden: Only Super Admin can manage staff admin accounts" }, 403);
    }

    if (data.action === "create_staff") {
      const cleanUsername = data.username.toLowerCase().trim();
      const internalEmail = `${cleanUsername}@portal.ceopower.local`;

      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("username", cleanUsername)
        .maybeSingle();

      if (existingProfile) {
        return jsonResponse({ error: "Username already taken" }, 409);
      }

      const { data: newAuthUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
        email: internalEmail,
        password: data.password,
        email_confirm: true,
        user_metadata: {
          role: "staff",
          username: cleanUsername,
          full_name: data.full_name,
        },
      });

      if (createAuthError) {
        return jsonResponse({ error: createAuthError.message }, 400);
      }

      const { data: profile, error: insertProfileErr } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: newAuthUser.user.id,
          role: "staff",
          username: cleanUsername,
          email: internalEmail,
          full_name: data.full_name.trim(),
          business_name: "CEO Power Staff",
          phone: data.phone.trim(),
          state: "Anambra",
          city: "Onitsha",
          status: "active",
        })
        .select()
        .single();

      if (insertProfileErr) {
        await supabaseAdmin.auth.admin.deleteUser(newAuthUser.user.id);
        return jsonResponse({ error: insertProfileErr.message }, 500);
      }

      const normalizedCategoryScope =
        data.category_scope && data.category_scope.length > 0 ? data.category_scope : null;

      const { data: permsRow, error: insertPermsErr } = await supabaseAdmin
        .from("staff_permissions")
        .insert({
          user_id: newAuthUser.user.id,
          permissions: data.permissions,
          category_scope: normalizedCategoryScope,
          reseller_scope: data.reseller_scope,
          preset: data.preset || null,
          updated_by: user.id,
        })
        .select()
        .single();

      if (insertPermsErr) {
        await supabaseAdmin.auth.admin.deleteUser(newAuthUser.user.id);
        return jsonResponse({ error: insertPermsErr.message }, 500);
      }

      await logActivity("staff.create", "staff", profile.id, {
        username: cleanUsername,
        full_name: data.full_name,
        preset: data.preset || null,
        permissions_count: data.permissions.length,
        reseller_scope: data.reseller_scope,
      });

      return jsonResponse({ success: true, profile, permissions: permsRow });
    }

    if (data.action === "update_staff_permissions") {
      if (data.user_id === user.id) {
        return jsonResponse({ error: "Cannot modify your own Super Admin account" }, 403);
      }

      const { data: target } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", data.user_id)
        .maybeSingle();

      if (!target || target.role !== "staff") {
        return jsonResponse({ error: "Target account is not a staff admin" }, 404);
      }

      if (data.full_name || data.phone) {
        await supabaseAdmin
          .from("profiles")
          .update({
            ...(data.full_name ? { full_name: data.full_name.trim() } : {}),
            ...(data.phone ? { phone: data.phone.trim() } : {}),
          })
          .eq("id", data.user_id);
      }

      const { data: prevPerms } = await supabaseAdmin
        .from("staff_permissions")
        .select("*")
        .eq("user_id", data.user_id)
        .maybeSingle();

      const normalizedCategoryScope =
        data.category_scope && data.category_scope.length > 0 ? data.category_scope : null;

      const { data: updatedPerms, error: upsertErr } = await supabaseAdmin
        .from("staff_permissions")
        .upsert({
          user_id: data.user_id,
          permissions: data.permissions,
          category_scope: normalizedCategoryScope,
          reseller_scope: data.reseller_scope,
          preset: data.preset ?? null,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        })
        .select()
        .single();

      if (upsertErr) {
        return jsonResponse({ error: upsertErr.message }, 400);
      }

      await logActivity("staff.update_permissions", "staff", data.user_id, {
        username: target.username,
        before: prevPerms
          ? { preset: prevPerms.preset, permissions: prevPerms.permissions, reseller_scope: prevPerms.reseller_scope }
          : null,
        after: { preset: data.preset ?? null, permissions: data.permissions, reseller_scope: data.reseller_scope },
      });

      return jsonResponse({ success: true, permissions: updatedPerms });
    }

    if (data.action === "reset_staff_password") {
      const { data: target } = await supabaseAdmin
        .from("profiles")
        .select("id, role, username")
        .eq("id", data.user_id)
        .maybeSingle();

      if (!target || target.role !== "staff") {
        return jsonResponse({ error: "Target account is not a staff admin" }, 404);
      }

      const { error: resetErr } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
        password: data.new_password,
      });
      if (resetErr) {
        return jsonResponse({ error: resetErr.message }, 400);
      }

      await logActivity("staff.reset_password", "staff", data.user_id, {
        username: target.username,
      });

      return jsonResponse({ success: true, message: "Staff password updated successfully" });
    }

    if (data.action === "set_staff_status") {
      if (data.user_id === user.id) {
        return jsonResponse({ error: "Super Admin cannot suspend their own account" }, 403);
      }

      const { data: target } = await supabaseAdmin
        .from("profiles")
        .select("id, role, status, username")
        .eq("id", data.user_id)
        .maybeSingle();

      if (!target || target.role !== "staff") {
        return jsonResponse({ error: "Target account is not a staff admin" }, 404);
      }

      const banDuration = data.status === "suspended" ? "876000h" : "none";
      await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
        ban_duration: banDuration,
      });

      const { data: updated, error: statusErr } = await supabaseAdmin
        .from("profiles")
        .update({ status: data.status })
        .eq("id", data.user_id)
        .select()
        .single();

      if (statusErr) {
        return jsonResponse({ error: statusErr.message }, 400);
      }

      await logActivity("staff.set_status", "staff", data.user_id, {
        username: target.username,
        before: { status: target.status },
        after: { status: data.status },
      });

      return jsonResponse({ success: true, profile: updated });
    }

    if (data.action === "delete_staff") {
      if (data.user_id === user.id) {
        return jsonResponse({ error: "Super Admin cannot delete their own account" }, 403);
      }

      const { data: target } = await supabaseAdmin
        .from("profiles")
        .select("id, role, username, full_name")
        .eq("id", data.user_id)
        .maybeSingle();

      if (!target || target.role !== "staff") {
        return jsonResponse({ error: "Target account is not a staff admin" }, 404);
      }

      const { error: deleteErr } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
      if (deleteErr) {
        return jsonResponse({ error: deleteErr.message }, 400);
      }

      await logActivity("staff.delete", "staff", data.user_id, {
        username: target.username,
        full_name: target.full_name,
      });

      return jsonResponse({ success: true, message: "Staff admin deleted" });
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (err: any) {
    return jsonResponse({ error: err.message || "Internal server error" }, 500);
  }
});
