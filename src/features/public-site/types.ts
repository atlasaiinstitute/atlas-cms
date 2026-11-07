import { getPublicSiteData } from "./public-site";
export type PublicSiteData = NonNullable<ReturnType<typeof getPublicSiteData>> & { organizationId: string };
