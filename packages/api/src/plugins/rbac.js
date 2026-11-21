/**
 * Role-based access control plugin.
 * fastify.requireRole(minimumRole) returns a preHandler that enforces role hierarchy.
 * Role levels: viewer=1, editor=2, admin=3.
 */

const ROLE_LEVEL = Object.freeze({ viewer: 1, editor: 2, admin: 3 });

/**
 * Level for a role string, 0 for anything that is not an own key of ROLE_LEVEL. The own-property
 * check matters: a plain lookup (even with `?? 0`) resolves inherited keys such as 'toString' or
 * '__proto__' to a non-numeric value, which never compares below a number and so would be granted.
 */
function roleLevel(role) {
  return typeof role === 'string' && Object.hasOwn(ROLE_LEVEL, role) ? ROLE_LEVEL[role] : 0;
}

async function rbacPlugin(fastify) {
  fastify.decorate('requireRole', function requireRole(minimumRole) {
    if (typeof minimumRole !== 'string' || !Object.hasOwn(ROLE_LEVEL, minimumRole)) {
      throw new Error(`requireRole: invalid role "${minimumRole}". Use viewer | editor | admin.`);
    }
    const minLevel = ROLE_LEVEL[minimumRole];

    return async function rbacPreHandler(request, reply) {
      if (request.orgId == null) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'No organization',
          code: 'NO_ORG',
        });
      }
      if (request.dbUser == null) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'User not found',
        });
      }

      const userLevel = roleLevel(request.dbUser.role);
      if (userLevel < minLevel) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Insufficient permissions',
        });
      }

      return;
    };
  });
}

// Same mechanism fastify-plugin uses: skip encapsulation so the requireRole decorator is visible
// at the root and to every route plugin (AGENTS.md: routes use fastify.requireRole).
rbacPlugin[Symbol.for('skip-override')] = true;

export default rbacPlugin;
