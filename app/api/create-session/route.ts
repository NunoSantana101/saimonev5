// app/api/create-session/route.ts
// Official ChatKit backend endpoint for Agent Builder workflows

export const runtime = "edge";

const DEFAULT_CHATKIT_BASE = "https://api.openai.com";
const SESSION_COOKIE_NAME = "chatkit_session_id";
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function POST(request: Request): Promise<Response> {
  let sessionCookie: string | null = null;
  
  try {
    // 1. Get environment variables
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const workflowId = process.env.NEXT_PUBLIC_CHATKIT_WORKFLOW_ID;

    console.log('[create-session] Starting session creation');
    console.log('[create-session] Workflow ID present:', !!workflowId);
    console.log('[create-session] API Key present:', !!openaiApiKey);

    if (!openaiApiKey) {
      console.error('[create-session] Missing OPENAI_API_KEY');
      return new Response(
        JSON.stringify({
          error: "Missing OPENAI_API_KEY environment variable",
          hint: "Add your OpenAI API key in Azure environment variables"
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!workflowId) {
      console.error('[create-session] Missing NEXT_PUBLIC_CHATKIT_WORKFLOW_ID');
      return new Response(
        JSON.stringify({
          error: "Missing NEXT_PUBLIC_CHATKIT_WORKFLOW_ID environment variable",
          hint: "Add your workflow ID from Agent Builder in Azure environment variables"
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 2. Get or create user ID from cookie
    const { userId, sessionCookie: resolvedSessionCookie } = 
      await resolveUserId(request);
    sessionCookie = resolvedSessionCookie;

    console.log('[create-session] User ID:', userId.substring(0, 15) + '...');
    console.log('[create-session] Creating session for workflow:', workflowId.substring(0, 15) + '...');

    // 3. Create ChatKit session with OpenAI
    const apiBase = process.env.CHATKIT_API_BASE ?? DEFAULT_CHATKIT_BASE;
    const url = `${apiBase}/v1/chatkit/sessions`;
    
    console.log('[create-session] Calling OpenAI API:', url);

    const upstreamResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`,
        "OpenAI-Beta": "chatkit_beta=v1", // CRITICAL: Correct beta header
      },
      body: JSON.stringify({
        workflow: { id: workflowId },
        user: userId,
        chatkit_configuration: {
          file_upload: {
            enabled: false,
          },
        },
      }),
    });

    console.log('[create-session] OpenAI response status:', upstreamResponse.status);

    if (!upstreamResponse.ok) {
      const errorText = await upstreamResponse.text();
      console.error('[create-session] OpenAI error:', errorText);
      
      let errorMessage = `Failed to create session: ${upstreamResponse.status}`;
      let hint = '';

      if (upstreamResponse.status === 404) {
        hint = 'Workflow not found. Make sure your workflow is published in Agent Builder and the ID is correct.';
      } else if (upstreamResponse.status === 401 || upstreamResponse.status === 403) {
        hint = 'Authentication failed. Make sure your API key is from the same project as your workflow.';
      }

      return buildJsonResponse(
        {
          error: errorMessage,
          details: errorText,
          hint: hint,
        },
        upstreamResponse.status,
        { "Content-Type": "application/json" },
        sessionCookie
      );
    }

    const upstreamJson = await upstreamResponse.json();
    console.log('[create-session] ✅ Session created successfully');
    console.log('[create-session] Session ID:', upstreamJson.id);

    // 4. Return response with cookie
    return buildJsonResponse(
      upstreamJson,
      200,
      { "Content-Type": "application/json" },
      sessionCookie
    );

  } catch (error: any) {
    console.error('[create-session] ❌ Unexpected error:', error);
    return buildJsonResponse(
      {
        error: "Internal server error",
        details: error?.message || "Unknown error",
        hint: "Check Azure logs for more details"
      },
      500,
      { "Content-Type": "application/json" },
      sessionCookie
    );
  }
}

// Helper: Resolve or create user ID
async function resolveUserId(
  request: Request
): Promise<{ userId: string; sessionCookie: string | null }> {
  const cookieHeader = request.headers.get("cookie") || "";
  const existingUserId = getCookieValue(cookieHeader, SESSION_COOKIE_NAME);

  if (existingUserId) {
    console.log('[create-session] Existing user found');
    return { userId: existingUserId, sessionCookie: null };
  }

  // Generate new user ID
  const newUserId = `user_${crypto.randomUUID()}`;
  const newCookie = serializeSessionCookie(newUserId);
  
  console.log('[create-session] New user created');
  return { userId: newUserId, sessionCookie: newCookie };
}

// Helper: Get cookie value
function getCookieValue(cookieHeader: string, name: string): string | null {
  const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// Helper: Serialize cookie
function serializeSessionCookie(userId: string): string {
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(userId)}; Max-Age=${SESSION_COOKIE_MAX_AGE}; Path=/; HttpOnly; SameSite=Lax; Secure`;
}

// Helper: Build JSON response with optional cookie
function buildJsonResponse(
  body: any,
  status: number,
  headers: Record<string, string>,
  sessionCookie: string | null
): Response {
  const responseHeaders = new Headers(headers);
  
  if (sessionCookie) {
    responseHeaders.set("Set-Cookie", sessionCookie);
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders,
  });
}
