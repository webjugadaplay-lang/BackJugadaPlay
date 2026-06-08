// services/fixtureSyncService.js
const axios = require('axios');
const sequelize = require('../config/database');

class FixtureSyncService {
    constructor(io) {
        this.io = io;
        this.isRunning = false;
        this.lastScores = new Map(); // Almacenar últimos marcadores conocidos
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
            this.lastScores.set(fixtureId, { home: newHomeScore, away: newAwayScore });
            return { hasChanges: true, isFirstTime: true };
        }

        const hasChanges = (lastScore.home !== newHomeScore) || (lastScore.away !== newAwayScore);
        
        if (hasChanges) {
            console.log(`⚽ ¡GOL DETECTADO! Fixture ${fixtureId}: ${lastScore.home}-${lastScore.away} → ${newHomeScore}-${newAwayScore}`);
            this.lastScores.set(fixtureId, { home: newHomeScore, away: newAwayScore });
        }

        return { hasChanges, isFirstTime: false };
    }

    // Actualizar la base de datos local
    async updateDatabase(fixtureId, goalsHome, goalsAway) {
        try {
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
            console.log(`✅ Base de datos actualizada: Fixture ${fixtureId} = ${goalsHome}-${goalsAway}`);
            return true;
        } catch (error) {
            console.error(`Error updating database for fixture ${fixtureId}:`, error);
            return false;
        }
    }

    // Notificar a los clientes via WebSocket
    async notifyClients(fixtureId, goalsHome, goalsAway) {
        try {
            // Buscar qué sala(s) están usando este fixture
            const rooms = await sequelize.query(
                `SELECT id FROM rooms WHERE fixture_id = :fixtureId`,
                { replacements: { fixtureId }, type: sequelize.QueryTypes.SELECT }
            );

            for (const room of rooms) {
                const roomName = `live-room-${room.id}`;
                this.io.to(roomName).emit('score-updated', {
                    fixtureId: fixtureId,
                    goals_home: goalsHome,
                    goals_away: goalsAway,
                    timestamp: new Date().toISOString()
                });
                console.log(`📡 Notificación enviada a sala: ${roomName}`);
            }
        } catch (error) {
            console.error(`Error notifying clients for fixture ${fixtureId}:`, error);
        }
    }

    // Procesar un fixture individual
    async processFixture(fixture) {
        const fixtureId = fixture.fixture.id;
        const newHomeScore = fixture.goals.home || 0;
        const newAwayScore = fixture.goals.away || 0;

        const { hasChanges, isFirstTime } = this.checkScoreChanges(fixtureId, newHomeScore, newAwayScore);

        if (hasChanges && !isFirstTime) {
            const updated = await this.updateDatabase(fixtureId, newHomeScore, newAwayScore);
            if (updated) {
                await this.notifyClients(fixtureId, newHomeScore, newAwayScore);
            }
        }
    }

    // Sincronización principal
    async sync() {
        if (this.isRunning) {
            console.log('⚠️ Sincronización ya en curso, omitiendo...');
            return;
        }

        this.isRunning = true;
        console.log('🔄 Iniciando sincronización con API-Football...');

        try {
            const liveFixtures = await this.fetchLiveFixtures();
            
            if (liveFixtures.length === 0) {
                console.log('📭 No hay partidos en vivo actualmente');
                this.isRunning = false;
                return;
            }

            console.log(`📊 Procesando ${liveFixtures.length} partidos en vivo`);

            for (const fixture of liveFixtures) {
                await this.processFixture(fixture);
            }

            console.log('✅ Sincronización completada');
        } catch (error) {
            console.error('Error en sincronización:', error);
        } finally {
            this.isRunning = false;
        }
    }

    // Iniciar el servicio programado
    start(intervalSeconds = 10) {
        console.log(`🚀 Iniciando servicio de sincronización automática cada ${intervalSeconds} segundos`);
        
        this.sync();
        
        setInterval(() => {
            this.sync();
        }, intervalSeconds * 1000);
    }
}

module.exports = FixtureSyncService;