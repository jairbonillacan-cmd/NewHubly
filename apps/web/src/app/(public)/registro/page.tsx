"use client";
import { LoginScreen } from "../login/page";

/** «Crear cuenta» con su propia URL limpia (#212), en lugar de /login?modo=registro. */
export default function RegistroPage() { return <LoginScreen initialMode="signup" />; }
