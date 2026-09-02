# Vultr: configurações da instância e Cloud-Init

Plano: High Performance `vhp-1c-2gb` (1 vCPU / 2 GB / 3 TB), São Paulo, Ubuntu 24.04 LTS.

## Configurações no painel

| Campo | Valor |
|---|---|
| Server Hostname / Label | `kingdc` |
| Instance Connectivity | Public IP, com IPv4 e IPv6 |
| VPC Network | nenhuma |
| Automatic Backups | desligado (temos `infra/backup.sh`) |
| DDoS Protection | desligado |
| Limited User Login | **marcado** (usuário `linuxuser` com sudo) |
| SSH Keys | a chave do seu Mac (`cat ~/.ssh/id_ed25519.pub`) |

## Cloud-Init User Data

Cole o bloco abaixo inteiro no campo "Cloud-Init User Data". Ele instala o Docker, cria
1 GB de swap, configura o firewall com as portas do Caddy e do LiveKit e deixa
`/opt/kingdc` pronto para o `git clone`.

```yaml
#cloud-config
package_update: true
package_upgrade: true
packages:
  - ufw
  - git
  - curl
runcmd:
  - curl -fsSL https://get.docker.com | sh
  - usermod -aG docker linuxuser
  - fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  - echo '/swapfile none swap sw 0 0' >> /etc/fstab
  - ufw default deny incoming
  - ufw default allow outgoing
  - ufw allow OpenSSH
  - ufw allow 80/tcp
  - ufw allow 443/tcp
  - ufw allow 443/udp
  - ufw allow 7881/tcp
  - ufw allow 3478/udp
  - ufw allow 50000:60000/udp
  - ufw allow from 172.16.0.0/12 to any port 7880 proto tcp
  - ufw --force enable
  - mkdir -p /opt/kingdc && chown linuxuser:linuxuser /opt/kingdc
```

## Depois de criar

1. Espere uns 3 minutos para o cloud-init terminar.
2. Teste o acesso: `ssh linuxuser@<IP>` e depois `docker compose version` e `sudo ufw status`.
3. Siga o [`docs/SETUP.md`](../docs/SETUP.md) a partir da seção "Produção (VPS Ubuntu)",
   passo 1 (DNS). Os passos 2 e 3 do guia já foram feitos pelo cloud-init.
