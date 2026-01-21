CREATE TABLE "Company" (
  id SERIAL PRIMARY KEY,
  name VARCHAR(128) UNIQUE NOT NULL
);

CREATE TABLE "Organization" (
  id SERIAL PRIMARY KEY,
  name VARCHAR(128) UNIQUE NOT NULL
);

CREATE TABLE "User" (
  id SERIAL PRIMARY KEY,
  email VARCHAR(64),
  password VARCHAR(64),
  "isAdmin" BOOLEAN DEFAULT FALSE,
  "companyId" INTEGER REFERENCES "Company"(id) ON DELETE SET NULL,
  "organizationId" INTEGER REFERENCES "Organization"(id) ON DELETE SET NULL
);

CREATE TABLE "UserCompany" (
  "userId" INTEGER REFERENCES "User"(id) ON DELETE CASCADE,
  "companyId" INTEGER REFERENCES "Company"(id) ON DELETE CASCADE,
  PRIMARY KEY ("userId", "companyId")
);

CREATE TABLE "UserOrganization" (
  "userId" INTEGER REFERENCES "User"(id) ON DELETE CASCADE,
  "organizationId" INTEGER REFERENCES "Organization"(id) ON DELETE CASCADE,
  PRIMARY KEY ("userId", "organizationId")
);

CREATE TABLE "Dashboard" (
  id SERIAL PRIMARY KEY,
  "publicId" VARCHAR(36),
  name VARCHAR(128) NOT NULL,
  template VARCHAR(32) NOT NULL,
  "sheetId" VARCHAR(128) NOT NULL,
  "sheetGid" VARCHAR(24) NOT NULL,
  "sheetUrl" VARCHAR(512) NOT NULL,
  "companyId" INTEGER REFERENCES "Company"(id) ON DELETE CASCADE,
  "organizationId" INTEGER REFERENCES "Organization"(id) ON DELETE SET NULL
);
