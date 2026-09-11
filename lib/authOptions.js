import GoogleProvider from 'next-auth/providers/google'
import connectDB from './mongoose'
import User from '../models/User'
import { setUserContext } from './logger'

// We keep authOptions in a separate file (not inside the route handler)
// because we'll need to reference it in multiple places later —
// the route handler, server components, and API route protection.

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          // These are the Gmail scopes we need.
          // 'offline' access_type is critical — this is what causes Google
          // to return a refresh token, which lets us act on behalf of the
          // user later without them being logged in.
          access_type: "offline",
          prompt: "consent",
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.labels",
            "https://www.googleapis.com/auth/gmail.modify",
          ].join(" "),
        },
      },
    }),
  ],

  callbacks: {
    // The 'signIn' callback fires right after Google returns the user.
    // This is where we save or update the user in MongoDB.
    async signIn({ user, account }) {
      console.log("=== signIn callback fired ===");
      console.log("provider:", account.provider);
      console.log("user email:", user.email);

      if (account.provider !== "google") return false;

      try {
        await connectDB();
        console.log("=== DB connected ===");

        const existingUser = await User.findOne({ googleId: user.id });
        console.log("=== existing user:", existingUser);

        if (existingUser) {
          if (account.refresh_token) {
            existingUser.refreshToken = account.refresh_token;
            await existingUser.save();
          }
        } else {
          await User.create({
            googleId: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            refreshToken: account.refresh_token,
          });
          console.log("=== new user created ===");
        }

        return true;
      } catch (error) {
        console.error("=== signIn error ===", error);
        return false;
      }
    },

    // The 'session' callback controls what's available via useSession()
    // on the frontend. We add the user's DB id and tier to the session
    // so we don't need to re-query MongoDB for basic info on every request.
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub;
        session.user.tier = token.tier;
        // Set user context for error tracking
        setUserContext({
          id: token.sub,
          email: session.user.email,
        })
      }
      return session;
    },

    // The 'jwt' callback fires whenever a JWT is created or updated.
    // We fetch the tier from DB here so it flows into the session above.
    async jwt({ token }) {
      if (token.sub) {
        await connectDB();
        const dbUser = await User.findOne({ googleId: token.sub });
        if (dbUser) {
          token.tier = dbUser.tier;
        }
      }
      return token;
    },
  },

  pages: {
    signIn: "/", // Redirect to landing page if sign-in is needed
  },
};