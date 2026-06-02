-- Create plans
INSERT INTO plans (id, name, tier, description, price_monthly, price_yearly, currency, is_active, features, limits)
VALUES
(gen_random_uuid(), 'Basico', 'FREE', 'Plan basico para empezar', 9900, 99000, 'ARS', true, '["whatsapp","ai_chat","1_agent"]', '{"maxAgents":1,"maxConversations":500,"maxMessages":5000}'),
(gen_random_uuid(), 'Pro', 'PRO', 'Plan profesional', 29900, 299000, 'ARS', true, '["whatsapp","ai_chat","5_agents","knowledge_base","analytics"]', '{"maxAgents":5,"maxConversations":5000,"maxMessages":50000}')
ON CONFLICT DO NOTHING;

-- Create admin tenant
INSERT INTO tenants (id, name, slug, email, "subscriptionTier", "createdAt")
VALUES (gen_random_uuid(), 'AgenTo Admin', 'agento-admin', 'admin@agento.com', 'ENTERPRISE', NOW())
ON CONFLICT DO NOTHING;

-- Link user to tenant as OWNER
INSERT INTO tenant_users ("tenantId", "userId", role, "createdAt")
SELECT t.id, u.id, 'OWNER', NOW()
FROM tenants t, users u
WHERE t.slug = 'agento-admin' AND u.email = 'admin@agento.com'
ON CONFLICT DO NOTHING;

-- Verify
SELECT u.email, tu.role, t.name as tenant FROM users u JOIN tenant_users tu ON u.id = tu."userId" JOIN tenants t ON tu."tenantId" = t.id;
