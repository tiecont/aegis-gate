export interface paths {
    "/v1/session": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["management1"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["management2"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["management3"];
        put?: never;
        post: operations["management4"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{org}/projects": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["management5"];
        put?: never;
        post: operations["management6"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{org}/members": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["management7"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/organizations/{org}/members/revoke": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["management8"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/projects/{project}/audit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["management9"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/projects/{project}/domains": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["management10"];
        put?: never;
        post: operations["management11"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/projects/{project}/domains/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["management12"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/projects/{project}/domains/{id}/revisions/{generation}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["management13"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/projects/{project}/origins": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["management14"];
        put?: never;
        post: operations["management15"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/projects/{project}/origins/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["management16"];
        put: operations["management17"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/projects/{project}/origins/{id}/revisions/{generation}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["management18"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/projects/{project}/policies": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["management19"];
        put?: never;
        post: operations["management20"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/projects/{project}/policies/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["management21"];
        put: operations["management22"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/projects/{project}/policies/{id}/revisions/{generation}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["management23"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/projects/{project}/routes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["management24"];
        put?: never;
        post: operations["management25"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/projects/{project}/routes/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["management26"];
        put: operations["management27"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/projects/{project}/routes/{id}/revisions/{generation}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["management28"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/projects/{project}/domains/{id}/verifications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["management29"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/projects/{project}/domain-verifications/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["management30"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/projects/{project}/routes/{id}/approve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["management31"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["beginManagementLogin"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/callback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["completeManagementLogin"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/healthz": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getHealth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/readyz": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getReadiness"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        ManagementPrincipal: {
            issuer: string;
            subject: string;
        };
        ManagementID: {
            /** Format: uuid */
            id: string;
        };
        ManagementStatus: {
            status: string;
        };
        ManagementName: {
            name: string;
        };
        ManagementMember: {
            issuer: string;
            subject: string;
            /** @enum {string} */
            role?: "owner" | "admin" | "security-admin" | "developer" | "billing-admin" | "viewer";
        };
        ManagementOrganization: {
            /** Format: uuid */
            id: string;
            name: string;
            role: string;
        };
        ManagementProject: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            organization_id: string;
            name: string;
        };
        OriginSpec: {
            /** Format: uri */
            url: string;
        };
        PolicySpec: {
            /** @enum {boolean} */
            auth_required: true;
            /** Format: uri */
            jwt_issuer: string;
            jwt_audience: string;
        };
        RouteSpec: {
            /** Format: uuid */
            domain_id: string;
            /** Format: uuid */
            origin_id: string;
            /** Format: uuid */
            policy_id: string;
            path: string;
            methods: ("GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS")[];
        };
        DomainInput: {
            hostname: string;
        };
        DomainClaim: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            project_id: string;
            hostname: string;
            /** @enum {string} */
            state: "pending" | "verified" | "active" | "failed" | "expired";
            /** Format: date-time */
            expires_at: string;
            txt_name: string;
            proof?: string;
        };
        ManagementResource: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            project_id: string;
            /** @enum {string} */
            kind: "domain" | "origin" | "policy" | "route";
            generation: number;
            spec: {
                [key: string]: unknown;
            };
        };
        VerificationJob: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            project_id: string;
            /** Format: uuid */
            domain_id: string;
            /** @enum {string} */
            state: "pending" | "running" | "succeeded" | "failed";
            attempts: number;
        };
        RouteApproval: {
            /** Format: uuid */
            route_id: string;
            route_generation: number;
            origin_generation: number;
            policy_generation: number;
        };
        AuditEvent: {
            sequence: number;
            action: string;
            /** @enum {string} */
            outcome: "allowed" | "denied";
            /** Format: date-time */
            at: string;
        };
        ErrorDetail: {
            code: string;
            message: string;
            /** Format: uuid */
            request_id: string;
        };
        ErrorEnvelope: {
            error: components["schemas"]["ErrorDetail"];
        };
        Health: {
            /** @enum {string} */
            service: "control-api";
            /** @enum {string} */
            status: "alive";
        };
    };
    responses: {
        /** @description A bounded error with server-generated correlation UUID */
        Unavailable: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
    };
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    management1: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful local management operation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagementPrincipal"];
                };
            };
            400: components["responses"]["Unavailable"];
            401: components["responses"]["Unavailable"];
            404: components["responses"]["Unavailable"];
            409: components["responses"]["Unavailable"];
            429: components["responses"]["Unavailable"];
            503: components["responses"]["Unavailable"];
        };
    };
    management2: {
        parameters: {
            query?: never;
            header: {
                "X-CSRF-Token": string;
                Origin: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful local management operation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagementStatus"];
                };
            };
            400: components["responses"]["Unavailable"];
            401: components["responses"]["Unavailable"];
            404: components["responses"]["Unavailable"];
            409: components["responses"]["Unavailable"];
            429: components["responses"]["Unavailable"];
            503: components["responses"]["Unavailable"];
        };
    };
    management3: {
        parameters: {
            query?: {
                after?: string;
                limit?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful local management operation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagementOrganization"][];
                };
            };
            400: components["responses"]["Unavailable"];
            401: components["responses"]["Unavailable"];
            404: components["responses"]["Unavailable"];
            409: components["responses"]["Unavailable"];
            429: components["responses"]["Unavailable"];
            503: components["responses"]["Unavailable"];
        };
    };
    management4: {
        parameters: {
            query?: never;
            header: {
                "X-CSRF-Token": string;
                Origin: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ManagementName"];
            };
        };
        responses: {
            /** @description Successful local management operation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagementID"];
                };
            };
            400: components["responses"]["Unavailable"];
            401: components["responses"]["Unavailable"];
            404: components["responses"]["Unavailable"];
            409: components["responses"]["Unavailable"];
            429: components["responses"]["Unavailable"];
            503: components["responses"]["Unavailable"];
        };
    };
    management5: {
        parameters: {
            query?: {
                after?: string;
                limit?: number;
            };
            header?: never;
            path: {
                org: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful local management operation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagementProject"][];
                };
            };
            400: components["responses"]["Unavailable"];
            401: components["responses"]["Unavailable"];
            404: components["responses"]["Unavailable"];
            409: components["responses"]["Unavailable"];
            429: components["responses"]["Unavailable"];
            503: components["responses"]["Unavailable"];
        };
    };
    management6: {
        parameters: {
            query?: never;
            header: {
                "X-CSRF-Token": string;
                Origin: string;
            };
            path: {
                org: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ManagementName"];
            };
        };
        responses: {
            /** @description Successful local management operation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagementID"];
                };
            };
            400: components["responses"]["Unavailable"];
            401: components["responses"]["Unavailable"];
            404: components["responses"]["Unavailable"];
            409: components["responses"]["Unavailable"];
            429: components["responses"]["Unavailable"];
            503: components["responses"]["Unavailable"];
        };
    };
    management7: {
        parameters: {
            query?: never;
            header: {
                "X-CSRF-Token": string;
                Origin: string;
            };
            path: {
                org: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ManagementMember"];
            };
        };
        responses: {
            /** @description Successful local management operation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagementStatus"];
                };
            };
            400: components["responses"]["Unavailable"];
            401: components["responses"]["Unavailable"];
            404: components["responses"]["Unavailable"];
            409: components["responses"]["Unavailable"];
            429: components["responses"]["Unavailable"];
            503: components["responses"]["Unavailable"];
        };
    };
    management8: {
        parameters: {
            query?: never;
            header: {
                "X-CSRF-Token": string;
                Origin: string;
            };
            path: {
                org: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ManagementMember"];
            };
        };
        responses: {
            /** @description Successful local management operation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagementStatus"];
                };
            };
            400: components["responses"]["Unavailable"];
            401: components["responses"]["Unavailable"];
            404: components["responses"]["Unavailable"];
            409: components["responses"]["Unavailable"];
            429: components["responses"]["Unavailable"];
            503: components["responses"]["Unavailable"];
        };
    };
    management9: {
        parameters: {
            query?: {
                after?: string;
                limit?: number;
            };
            header?: never;
            path: {
                project: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful local management operation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AuditEvent"][];
                };
            };
            400: components["responses"]["Unavailable"];
            401: components["responses"]["Unavailable"];
            404: components["responses"]["Unavailable"];
            409: components["responses"]["Unavailable"];
            429: components["responses"]["Unavailable"];
            503: components["responses"]["Unavailable"];
        };
    };
    management10: {
        parameters: {
            query?: {
                after?: string;
                limit?: number;
            };
            header?: never;
            path: {
                project: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful local management operation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagementResource"][];
                };
            };
            400: components["responses"]["Unavailable"];
            401: components["responses"]["Unavailable"];
            404: components["responses"]["Unavailable"];
            409: components["responses"]["Unavailable"];
            429: components["responses"]["Unavailable"];
            503: components["responses"]["Unavailable"];
        };
    };
    management11: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
                "X-CSRF-Token": string;
                Origin: string;
            };
            path: {
                project: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DomainInput"];
            };
        };
        responses: {
            /** @description Successful local management operation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DomainClaim"];
                };
            };
            400: components["responses"]["Unavailable"];
            401: components["responses"]["Unavailable"];
            404: components["responses"]["Unavailable"];
            409: components["responses"]["Unavailable"];
            429: components["responses"]["Unavailable"];
            503: components["responses"]["Unavailable"];
        };
    };
    management12: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                project: string;
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful local management operation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DomainClaim"];
                };
            };
            400: components["responses"]["Unavailable"];
            401: components["responses"]["Unavailable"];
            404: components["responses"]["Unavailable"];
            409: components["responses"]["Unavailable"];
            429: components["responses"]["Unavailable"];
            503: components["responses"]["Unavailable"];
        };
    };
    management13: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                project: string;
                id: string;
                generation: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful local management operation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagementResource"];
                };
            };
            400: components["responses"]["Unavailable"];
            401: components["responses"]["Unavailable"];
            404: components["responses"]["Unavailable"];
            409: components["responses"]["Unavailable"];
            429: components["responses"]["Unavailable"];
            503: components["responses"]["Unavailable"];
        };
    };
    management14: {
        parameters: {
            query?: {
                after?: string;
                limit?: number;
            };
            header?: never;
            path: {
                project: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful local management operation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagementResource"][];
                };
            };
            400: components["responses"]["Unavailable"];
            401: components["responses"]["Unavailable"];
            404: components["responses"]["Unavailable"];
            409: components["responses"]["Unavailable"];
            429: components["responses"]["Unavailable"];
            503: components["responses"]["Unavailable"];
        };
    };
    management15: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
                "X-CSRF-Token": string;
                Origin: string;
            };
            path: {
                project: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OriginSpec"];
            };
        };
        responses: {
            /** @description Successful local management operation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagementResource"];
                };
            };
            400: components["responses"]["Unavailable"];
            401: components["responses"]["Unavailable"];
            404: components["responses"]["Unavailable"];
            409: components["responses"]["Unavailable"];
            429: components["responses"]["Unavailable"];
            503: components["responses"]["Unavailable"];
        };
    };
    management16: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                project: string;
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful local management operation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagementResource"];
                };
            };
            400: components["responses"]["Unavailable"];
            401: components["responses"]["Unavailable"];
            404: components["responses"]["Unavailable"];
            409: components["responses"]["Unavailable"];
            429: components["responses"]["Unavailable"];
            503: components["responses"]["Unavailable"];
        };
    };
    management17: {
        parameters: {
            query?: never;
            header: {
                "If-Match": string;
                "X-CSRF-Token": string;
                Origin: string;
            };
            path: {
                project: string;
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["OriginSpec"];
            };
        };
        responses: {
            /** @description Successful local management operation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagementResource"];
                };
            };
            400: components["responses"]["Unavailable"];
            401: components["responses"]["Unavailable"];
            404: components["responses"]["Unavailable"];
            409: components["responses"]["Unavailable"];
            429: components["responses"]["Unavailable"];
            503: components["responses"]["Unavailable"];
        };
    };
    management18: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                project: string;
                id: string;
                generation: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful local management operation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagementResource"];
                };
            };
            400: components["responses"]["Unavailable"];
            401: components["responses"]["Unavailable"];
            404: components["responses"]["Unavailable"];
            409: components["responses"]["Unavailable"];
            429: components["responses"]["Unavailable"];
            503: components["responses"]["Unavailable"];
        };
    };
    management19: {
        parameters: {
            query?: {
                after?: string;
                limit?: number;
            };
            header?: never;
            path: {
                project: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful local management operation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagementResource"][];
                };
            };
            400: components["responses"]["Unavailable"];
            401: components["responses"]["Unavailable"];
            404: components["responses"]["Unavailable"];
            409: components["responses"]["Unavailable"];
            429: components["responses"]["Unavailable"];
            503: components["responses"]["Unavailable"];
        };
    };
    management20: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
                "X-CSRF-Token": string;
                Origin: string;
            };
            path: {
                project: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PolicySpec"];
            };
        };
        responses: {
            /** @description Successful local management operation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagementResource"];
                };
            };
            400: components["responses"]["Unavailable"];
            401: components["responses"]["Unavailable"];
            404: components["responses"]["Unavailable"];
            409: components["responses"]["Unavailable"];
            429: components["responses"]["Unavailable"];
            503: components["responses"]["Unavailable"];
        };
    };
    management21: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                project: string;
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful local management operation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagementResource"];
                };
            };
            400: components["responses"]["Unavailable"];
            401: components["responses"]["Unavailable"];
            404: components["responses"]["Unavailable"];
            409: components["responses"]["Unavailable"];
            429: components["responses"]["Unavailable"];
            503: components["responses"]["Unavailable"];
        };
    };
    management22: {
        parameters: {
            query?: never;
            header: {
                "If-Match": string;
                "X-CSRF-Token": string;
                Origin: string;
            };
            path: {
                project: string;
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PolicySpec"];
            };
        };
        responses: {
            /** @description Successful local management operation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagementResource"];
                };
            };
            400: components["responses"]["Unavailable"];
            401: components["responses"]["Unavailable"];
            404: components["responses"]["Unavailable"];
            409: components["responses"]["Unavailable"];
            429: components["responses"]["Unavailable"];
            503: components["responses"]["Unavailable"];
        };
    };
    management23: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                project: string;
                id: string;
                generation: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful local management operation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagementResource"];
                };
            };
            400: components["responses"]["Unavailable"];
            401: components["responses"]["Unavailable"];
            404: components["responses"]["Unavailable"];
            409: components["responses"]["Unavailable"];
            429: components["responses"]["Unavailable"];
            503: components["responses"]["Unavailable"];
        };
    };
    management24: {
        parameters: {
            query?: {
                after?: string;
                limit?: number;
            };
            header?: never;
            path: {
                project: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful local management operation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagementResource"][];
                };
            };
            400: components["responses"]["Unavailable"];
            401: components["responses"]["Unavailable"];
            404: components["responses"]["Unavailable"];
            409: components["responses"]["Unavailable"];
            429: components["responses"]["Unavailable"];
            503: components["responses"]["Unavailable"];
        };
    };
    management25: {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
                "X-CSRF-Token": string;
                Origin: string;
            };
            path: {
                project: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RouteSpec"];
            };
        };
        responses: {
            /** @description Successful local management operation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagementResource"];
                };
            };
            400: components["responses"]["Unavailable"];
            401: components["responses"]["Unavailable"];
            404: components["responses"]["Unavailable"];
            409: components["responses"]["Unavailable"];
            429: components["responses"]["Unavailable"];
            503: components["responses"]["Unavailable"];
        };
    };
    management26: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                project: string;
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful local management operation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagementResource"];
                };
            };
            400: components["responses"]["Unavailable"];
            401: components["responses"]["Unavailable"];
            404: components["responses"]["Unavailable"];
            409: components["responses"]["Unavailable"];
            429: components["responses"]["Unavailable"];
            503: components["responses"]["Unavailable"];
        };
    };
    management27: {
        parameters: {
            query?: never;
            header: {
                "If-Match": string;
                "X-CSRF-Token": string;
                Origin: string;
            };
            path: {
                project: string;
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RouteSpec"];
            };
        };
        responses: {
            /** @description Successful local management operation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagementResource"];
                };
            };
            400: components["responses"]["Unavailable"];
            401: components["responses"]["Unavailable"];
            404: components["responses"]["Unavailable"];
            409: components["responses"]["Unavailable"];
            429: components["responses"]["Unavailable"];
            503: components["responses"]["Unavailable"];
        };
    };
    management28: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                project: string;
                id: string;
                generation: number;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful local management operation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagementResource"];
                };
            };
            400: components["responses"]["Unavailable"];
            401: components["responses"]["Unavailable"];
            404: components["responses"]["Unavailable"];
            409: components["responses"]["Unavailable"];
            429: components["responses"]["Unavailable"];
            503: components["responses"]["Unavailable"];
        };
    };
    management29: {
        parameters: {
            query?: never;
            header: {
                "X-CSRF-Token": string;
                Origin: string;
            };
            path: {
                project: string;
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful local management operation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VerificationJob"];
                };
            };
            400: components["responses"]["Unavailable"];
            401: components["responses"]["Unavailable"];
            404: components["responses"]["Unavailable"];
            409: components["responses"]["Unavailable"];
            429: components["responses"]["Unavailable"];
            503: components["responses"]["Unavailable"];
        };
    };
    management30: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                project: string;
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful local management operation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VerificationJob"];
                };
            };
            400: components["responses"]["Unavailable"];
            401: components["responses"]["Unavailable"];
            404: components["responses"]["Unavailable"];
            409: components["responses"]["Unavailable"];
            429: components["responses"]["Unavailable"];
            503: components["responses"]["Unavailable"];
        };
    };
    management31: {
        parameters: {
            query?: never;
            header: {
                "If-Match": string;
                "X-CSRF-Token": string;
                Origin: string;
            };
            path: {
                project: string;
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Successful local management operation */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RouteApproval"];
                };
            };
            400: components["responses"]["Unavailable"];
            401: components["responses"]["Unavailable"];
            404: components["responses"]["Unavailable"];
            409: components["responses"]["Unavailable"];
            429: components["responses"]["Unavailable"];
            503: components["responses"]["Unavailable"];
        };
    };
    beginManagementLogin: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Redirect to configured OIDC authorization endpoint; sets Secure HttpOnly SameSite=Lax browser binding cookie */
            302: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            429: components["responses"]["Unavailable"];
            503: components["responses"]["Unavailable"];
        };
    };
    completeManagementLogin: {
        parameters: {
            query: {
                state: string;
                code: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Authenticated; sets Secure session cookie and session-bound CSRF cookie */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ManagementStatus"];
                };
            };
            401: components["responses"]["Unavailable"];
            503: components["responses"]["Unavailable"];
        };
    };
    getHealth: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Process alive, not a readiness assertion */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["Health"];
                };
            };
        };
    };
    getReadiness: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description A bounded error with server-generated correlation UUID */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
        };
    };
}
