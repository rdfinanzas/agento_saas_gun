/**
 * Skills Routes - Rutas para gestión de Skills
 *
 * Endpoints para instalar, configurar y ejecutar skills
 */

import { Router } from 'express';
import { skillsController } from '../controllers/skills.controller';
import { tenantFromParamsMiddleware } from '../middleware/tenant.middleware';

const router = Router();

// Todas las rutas requieren autenticación de tenant
router.use(tenantFromParamsMiddleware);

/**
 * @route   GET /api/v1/:tenant/skills/installed
 * @desc    Obtiene los skills instalados del tenant
 * @access  Private
 */
router.get('/installed', skillsController.getInstalledSkills.bind(skillsController));

/**
 * @route   GET /api/v1/:tenant/skills/marketplace
 * @desc    Obtiene skills disponibles en el marketplace
 * @access  Private
 * @query   category - Filtrar por categoría
 * @query   search - Buscar por nombre/descripción
 * @query   tags - Filtrar por tags (separados por coma)
 * @query   page - Página (default: 1)
 * @query   pageSize - Tamaño de página (default: 20)
 */
router.get('/marketplace', skillsController.getMarketplaceSkills.bind(skillsController));

/**
 * @route   GET /api/v1/:tenant/skills/marketplace/:skillId
 * @desc    Obtiene un skill específico del marketplace
 * @access  Private
 */
router.get('/marketplace/:skillId', skillsController.getMarketplaceSkill.bind(skillsController));

/**
 * @route   POST /api/v1/:tenant/skills/install
 * @desc    Instala un skill del marketplace
 * @access  Private
 * @body    { marketplaceSkillId: string, config?: object }
 */
router.post('/install', skillsController.installSkill.bind(skillsController));

/**
 * @route   DELETE /api/v1/:tenant/skills/:installationId
 * @desc    Desinstala un skill
 * @access  Private
 */
router.delete('/:installationId', skillsController.uninstallSkill.bind(skillsController));

/**
 * @route   PUT /api/v1/:tenant/skills/:installationId/config
 * @desc    Actualiza la configuración de un skill instalado
 * @access  Private
 * @body    { config: object }
 */
router.put('/:installationId/config', skillsController.updateSkillConfig.bind(skillsController));

/**
 * @route   PUT /api/v1/:tenant/skills/:installationId/update
 * @desc    Actualiza un skill instalado a una nueva versión
 * @access  Private
 */
router.put('/:installationId/update', skillsController.updateSkill.bind(skillsController));

/**
 * @route   GET /api/v1/:tenant/skills/:installationId/tools
 * @desc    Obtiene las herramientas disponibles de un skill instalado
 * @access  Private
 */
router.get('/:installationId/tools', skillsController.getSkillTools.bind(skillsController));

/**
 * @route   POST /api/v1/:tenant/skills/execute
 * @desc    Ejecuta un skill instalado
 * @access  Private
 * @body    { installationId: string, toolName: string, input: object }
 */
router.post('/execute', skillsController.executeSkill.bind(skillsController));

/**
 * @route   GET /api/v1/:tenant/skills/marketplace/:skillId/validate
 * @desc    Valida la compatibilidad de un skill con el tenant
 * @access  Private
 */
router.get('/marketplace/:skillId/validate', skillsController.validateSkillCompatibility.bind(skillsController));

export default router;
