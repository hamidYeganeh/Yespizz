"use client";
import { Button } from "@heroui/react";
import { createAuthClient } from "better-auth/react";
import { useRouter } from "next/navigation";
const client = createAuthClient();
export function SignOut(){
  const router=useRouter();
  return <Button variant="secondary" onPress={async()=>{const result=await client.signOut(); if(!result.error) router.replace("/auth/sign-in");}}>Sign out</Button>;
}
