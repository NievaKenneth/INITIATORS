
import { requireUser } from "@/lib/supabase/auth";
 import {
   getCurrentUserPermissionSummary,
   PermissionDeniedError,
   PermissionVerificationError,
   type CurrentUserPermissionSummary,
 } from "@/lib/supabase/permissions";
 import { redirect } from "next/navigation";
 import Link from "next/link";

 export default async function UserDashboardPage() {
   const user = await requireUser();

   let permissionSummary: CurrentUserPermissionSummary;

   try {
     permissionSummary = await getCurrentUserPermissionSummary();
   } catch (error) {
     if (error instanceof PermissionDeniedError) {
       redirect("/");
     }

     if (error instanceof PermissionVerificationError) {
       return (
         <main className="min-h-screen p-8">
           <h1 className="text-2xl font-bold">Modules unavailable</h1>
           <p className="mt-2">
             Your account access could not be verified. Please try again later.
           </p>
         </main>
       );
     }

     throw error;
   }

   if (
     permissionSummary.role !== "user" &&
     permissionSummary.role !== "admin" &&
     permissionSummary.role !== "superadmin"
   ) {
     redirect("/");
   }

   return (
     <main className="min-h-screen p-8">
       <h1 className="text-2xl font-bold">Dashboard</h1>
       <p className="mt-2">
         Welcome! You are logged in as a {permissionSummary.role}.
       </p>
       <p className="mt-1 text-sm text-gray-500">{user.email}</p>
       {permissionSummary.visibleModules.includes("users") && (
         <section className="mt-8" aria-labelledby="available-modules-title">
           <h2
             id="available-modules-title"
             className="text-xl font-semibold"
           >
             Available modules
           </h2>
           <div className="feature-grid mt-4">
             <Link className="feature-card" href="/dashboard">
               <h3 className="text-lg font-semibold">User Management</h3>
               <p>Open User Management with your assigned access.</p>
             </Link>
           </div>
         </section>
       )}
     </main>
   );
 }
