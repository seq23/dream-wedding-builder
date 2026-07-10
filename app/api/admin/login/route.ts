import { NextResponse } from 'next/server';
import { createAdminSession, verifyPassword } from '@/lib/admin-auth';
export async function POST(req:Request){
 const origin=req.headers.get('origin'); const host=req.headers.get('host'); if(origin&&host&&!origin.includes(host)) return NextResponse.json({error:'Origin rejected'},{status:403});
 const {password}=await req.json(); if(typeof password!=='string'||!verifyPassword(password)) return NextResponse.json({error:'Invalid credentials'},{status:401});
 await createAdminSession(); return NextResponse.json({ok:true});
}
