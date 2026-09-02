#!/usr/bin/env bash
# Backup do King DC: pg_dump do Postgres + tar do volume de avatares, com retenção.
#
# Uso (na VPS, na raiz do repositório ou de qualquer lugar):
#   infra/backup.sh                  # grava em ./backups/
#   BACKUP_DIR=/mnt/backup infra/backup.sh
#   RETENTION_DAYS=30 infra/backup.sh
#
# Agendar no cron do host (todo dia às 03:00, log em /var/log/kingdc-backup.log):
#   sudo crontab -e
#   0 3 * * * /opt/kingdc/infra/backup.sh >> /var/log/kingdc-backup.log 2>&1
#
# Disco da própria VPS não é backup. Copie a pasta para fora, por exemplo com rclone:
#   rclone sync /opt/kingdc/backups remoto:kingdc-backups
#
# Restaurar (com a stack no ar):
#   gunzip -c backups/kingdc-db-<data>.sql.gz \
#     | docker compose -f docker-compose.yml exec -T postgres psql -U kingdc -d kingdc
#   docker compose -f docker-compose.yml exec -T api tar xzf - -C /data \
#     < backups/kingdc-avatars-<data>.tar.gz
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
BACKUP_DIR=${BACKUP_DIR:-$ROOT/backups}
RETENTION_DAYS=${RETENTION_DAYS:-14}
STAMP=$(date +%Y%m%d-%H%M%S)

# Só o arquivo base: o override de dev não muda os containers, e assim o mesmo comando
# vale em produção. O nome do projeto vem do compose (`name:` ou COMPOSE_PROJECT_NAME).
compose() {
  docker compose --project-directory "$ROOT" -f "$ROOT/docker-compose.yml" "$@"
}

mkdir -p "$BACKUP_DIR"

db="$BACKUP_DIR/kingdc-db-$STAMP.sql.gz"
avatars="$BACKUP_DIR/kingdc-avatars-$STAMP.tar.gz"

# Grava em .part e renomeia no fim: um dump interrompido nunca vira um arquivo "válido".
# --clean --if-exists deixa o dump restaurável por cima de um banco já populado.
compose exec -T postgres pg_dump -U kingdc -d kingdc --clean --if-exists --no-owner --no-privileges \
  | gzip -9 > "$db.part"
mv "$db.part" "$db"

compose exec -T api tar czf - -C /data avatars > "$avatars.part"
mv "$avatars.part" "$avatars"

find "$BACKUP_DIR" -maxdepth 1 -name 'kingdc-*' -type f -mtime +"$RETENTION_DAYS" -delete

echo "backup ok: $(du -h "$db" | cut -f1) $db"
echo "backup ok: $(du -h "$avatars" | cut -f1) $avatars"
