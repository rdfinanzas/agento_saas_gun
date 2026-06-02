-- Seed Agent Templates
INSERT INTO agent_templates (id, name, slug, description, short_description, type, config, is_active, is_public, is_official, metadata) VALUES
(gen_random_uuid(), 'Restaurante y Comida', 'restaurante-comida',
 'Agente para restaurantes, rotiserias, pizzerias. Maneja pedidos, menu, delivery, horarios.',
 'Pedidos, menu, delivery', 'INTERNAL',
 '{"systemPrompt":"Sos el asistente virtual de un restaurante. Tomar pedidos de comida, informar menu y precios, coordinar entregas. Siempre confirmar items y total antes de crear pedido. Preguntar si es delivery o retiro.","tools":["searchProducts","getProductDetails","checkStock","findCustomer","createCustomer","createOrder"],"welcomeMessage":"Hola! Bienvenido! Como puedo ayudarte hoy?","variables":[{"key":"business_name","label":"Nombre del negocio","type":"string","required":true}],"category":"food","maxTokens":1500,"temperature":0.7}',
 true, true, true, '{"author":"AgenTo","version":"1.0.0"}'),

(gen_random_uuid(), 'Farmacia', 'farmacia',
 'Agente para farmacias. Consulta de medicamentos, precios, stock, recetas.',
 'Medicamentos, precios, recetas', 'INTERNAL',
 '{"systemPrompt":"Sos el asistente virtual de una farmacia. Consultar medicamentos y productos, informar precios y stock, coordinar entregas. NUNCA recetar medicamentos. Si requiere receta, informar que debe presentarla.","tools":["searchProducts","getProductDetails","checkStock","findCustomer","createCustomer","createOrder"],"welcomeMessage":"Hola! Bienvenido a la farmacia. En que puedo ayudarte?","variables":[{"key":"business_name","label":"Nombre","type":"string","required":true}],"category":"health","maxTokens":1500,"temperature":0.5}',
 true, true, true, '{"author":"AgenTo","version":"1.0.0"}'),

(gen_random_uuid(), 'Tienda de Ropa', 'tienda-ropa',
 'Agente para tiendas de indumentaria. Talles, colores, stock, novedades.',
 'Indumentaria, talles, novedades', 'INTERNAL',
 '{"systemPrompt":"Sos el asistente virtual de una tienda de ropa. Mostrar catalogo, consultar talles y colores, informar precios, vender. Preguntar siempre que talle necesita. Si no hay stock, ofrecer alternativas.","tools":["searchProducts","getProductDetails","checkStock","findCustomer","createCustomer","createOrder"],"welcomeMessage":"Hola! Bienvenido/a! Que estas buscando hoy?","variables":[{"key":"business_name","label":"Nombre","type":"string","required":true}],"category":"retail","maxTokens":1500,"temperature":0.7}',
 true, true, true, '{"author":"AgenTo","version":"1.0.0"}'),

(gen_random_uuid(), 'Supermercado', 'supermercado',
 'Agente para supermercados y almacenes. Lista de compras, precios, promos, delivery.',
 'Groceries, promos, delivery', 'INTERNAL',
 '{"systemPrompt":"Sos el asistente virtual de un supermercado. Recibir pedidos por WhatsApp. Buscar productos, armar carrito, crear orden. Confirmar siempre el total antes de cerrar el pedido. Coordinar delivery.","tools":["searchProducts","getProductDetails","checkStock","findCustomer","createCustomer","createOrder"],"welcomeMessage":"Hola! Bienvenido! Que necesitas hoy?","variables":[{"key":"business_name","label":"Nombre","type":"string","required":true}],"category":"food","maxTokens":2000,"temperature":0.6}',
 true, true, true, '{"author":"AgenTo","version":"1.0.0"}'),

(gen_random_uuid(), 'Servicios Profesionales', 'servicios-profesionales',
 'Agente para profesionales. Turnos, consultas, informacion de servicios.',
 'Turnos, consultas, servicios', 'INTERNAL',
 '{"systemPrompt":"Sos el asistente virtual de un servicio profesional. Informar sobre servicios y tarifas, coordinar turnos, responder consultas. Ser profesional. No dar consejos profesionales, solo informacion general. Derivar consultas complejas al profesional.","tools":["searchProducts","getProductDetails","findCustomer","createCustomer","searchKnowledge"],"welcomeMessage":"Hola! Bienvenido. En que puedo ayudarte?","variables":[{"key":"business_name","label":"Nombre","type":"string","required":true}],"category":"services","maxTokens":1500,"temperature":0.5}',
 true, true, true, '{"author":"AgenTo","version":"1.0.0"}')
ON CONFLICT DO NOTHING;
