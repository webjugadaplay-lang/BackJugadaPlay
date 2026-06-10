const axios = require('axios');
const sequelize = require('../config/database');

class FixtureUpdateService {
    constructor() {
        this.lastScores = new Map(); // Almacenar últimos marcadores conocidos
        this.isRunning = false;
    }

    // Obtener fixtures en vivo desde API-Football
    async fetchLiveFixtures() {
        try {
            const response = await axios.get('https://v3.football.api-sports.io/fixtures', {
                params: { live: 'all' },
                headers: {
                    'x-apisports-key': process.env.API_FOOTBALL_KEY
                }
            });

            return response.data.response;
        } catch (error) {
            console.error('Error fetching live fixtures:', error.message);
            return [];
        }
    }

    // Verificar si hubo cambios en los goles
    checkScoreChanges(fixtureId, newHomeScore, newAwayScore) {
        const lastScore = this.lastScores.get(fixtureId);
        
        if (!lastScore) {
            // Primera vez que vemos este fixture
            this.lastScores.set(fixtureId, { home: newHomeScore, away: newAwayScore });
            return { hasChanges: false, isFirstTime: true };
        }

        const hasChanges = (lastScore.home !== newHomeScore) || (lastScore.away !== newAwayScore);
        
        if (hasChanges) {
            console.log(`⚽ CAMBIO DETECTADO - Fixture ${fixtureId}: ${lastScore.home}-${lastScore.away} → ${newHomeScore}-${newAwayScore}`);
            this.lastScores.set(fixtureId, { home: newHomeScore, away: newAwayScore });
        }

        return { hasChanges, isFirstTime: false };
    }

    // Actualizar la base de datos local
    async updateDatabase(fixtureId, goalsHome, goalsAway) {
        try {
            // Verificar si el fixture existe en la base de datos
            const [fixture] = await sequelize.query(
                `SELECT id, goals_home, goals_away FROM fixtures WHERE id = :fixtureId`,
                {
                    replacements: { fixtureId },
                    type: sequelize.QueryTypes.SELECT
                }
            );

            if (!fixture) {
                console.log(`⚠️ Fixture ${fixtureId} no encontrado en la base de datos local`);
                return false;
            }

            // Solo actualizar si realmente hay cambios
            if (fixture.goals_home === goalsHome && fixture.goals_away === goalsAway) {
                console.log(`ℹ️ Fixture ${fixtureId} ya está actualizado: ${goalsHome}-${goalsAway}`);
                return false;
            }

            // Actualizar la base de datos
            await sequelize.query(
                `UPDATE fixtures 
                 SET goals_home = :goalsHome, 
                     goals_away = :goalsAway,
                     updated_at = NOW()
                 WHERE id = :fixtureId`,
                {
                    replacements: { goalsHome, goalsAway, fixtureId },
                    type: sequelize.QueryTypes.UPDATE
                }
            );
            
            console.log(`✅ BASE DE DATOS ACTUALIZADA - Fixture ${fixtureId}: ${goalsHome}-${goalsAway}`);
            return true;
        } catch (error) {
            console.error(`Error updating database for fixture ${fixtureId}:`, error);
            return false;
        }
    }

    // Procesar un fixture individual
    async processFixture(fixture) {
        const fixtureId = fixture.fixture.id;
        const newHomeScore = fixture.goals.home || 0;
        const newAwayScore = fixture.goals.away || 0;

        // Verificar cambios
        const { hasChanges, isFirstTime } = this.checkScoreChanges(fixtureId, newHomeScore, newAwayScore);

        // Solo actualizar si hay cambios reales (ignorar la primera vez)
        if (hasChanges && !isFirstTime) {
            await this.updateDatabase(fixtureId, newHomeScore, newAwayScore);
            return true; // Hubo actualización
        }
        
        return false; // No hubo cambios
    }

    // Sincronización principal - Solo actualiza la base de datos
    async sync() {
        if (this.isRunning) {
            console.log('⚠️ Sincronización ya en curso, omitiendo...');
            return;
        }

        this.isRunning = true;
        console.log('🔄 Verificando cambios en API-Football...');

        try {
            const liveFixtures = await this.fetchLiveFixtures();
            
            if (liveFixtures.length === 0) {
                console.log('📭 No hay partidos en vivo actualmente');
                this.isRunning = false;
                return;
            }

            console.log(`📊 Revisando ${liveFixtures.length} partidos en vivo`);
            let updatedCount = 0;

            for (const fixture of liveFixtures) {
                const wasUpdated = await this.processFixture(fixture);
                if (wasUpdated) updatedCount++;
            }

            if (updatedCount > 0) {
                console.log(`✅ Sincronización completada - ${updatedCount} fixtures actualizados`);
            } else {
                console.log(`✅ Sincronización completada - Sin cambios detectados`);
            }
        } catch (error) {
            console.error('Error en sincronización:', error);
        } finally {
            this.isRunning = false;
        }
    }

    // Iniciar el servicio programado
    start(intervalSeconds = 10) {
        console.log(`🚀 Iniciando servicio de actualización de fixtures cada ${intervalSeconds} segundos`);
        console.log(`📝 Solo actualizará la base de datos - SIN notificaciones WebSocket`);
        
        // Ejecutar inmediatamente
        this.sync();
        
        // Programar ejecuciones periódicas
        setInterval(() => {
            this.sync();
        }, intervalSeconds * 1000);
    }

    // Detener el servicio
    stop() {
        console.log('🛑 Deteniendo servicio de actualización de fixtures');
        this.isRunning = true; // Previene nuevas ejecuciones
    }
}

module.exports = FixtureUpdateService;