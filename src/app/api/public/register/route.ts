import { NextResponse } from "next/server";
import { registrationDecision } from "@/features/public-site/public-site";
export async function POST() { const decision = registrationDecision(); if (!decision.allowed) return NextResponse.json({ error: decision.message, code: "PUBLIC_REGISTRATION_DISABLED" }, { status: 403 }); return NextResponse.json({ message: decision.message }, { status: 202 }); }
