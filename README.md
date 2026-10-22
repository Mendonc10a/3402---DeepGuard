Integrantes:

  1- Caio Ribeiro Lopes
  
  2- João Gaabriel Capistrano Mendonça
  
  3- Luis Paulo Baldoni dos Santos Mello
  
  4- Luiz Henrique Schmidt Silva


# AI Detection Website

## Descrição

O AI Detection Website é uma plataforma desenvolvida para identificar conteúdos gerados por Inteligência Artificial. O sistema permite que usuários enviem textos ou imagens para análise, retornando uma classificação acompanhada de uma porcentagem de confiança.

O objetivo é auxiliar usuários na verificação da autenticidade de conteúdos digitais, contribuindo para o combate à desinformação e ao uso indevido de mídias geradas artificialmente.

---

## Objetivos

- Detectar textos produzidos por Inteligência Artificial.
- Detectar imagens geradas por IA.
- Exibir o resultado da análise de forma simples e intuitiva.
- Apresentar uma porcentagem de confiança para cada resultado.
- Disponibilizar uma interface acessível para qualquer usuário.

---

## Tecnologias Utilizadas

### Front-end

- HTML
- CSS
- JavaScript

### Back-end

- Python
- FastAPI

### Banco de Dados

- SQLite

### Inteligência Artificial

- Hugging Face
- PyTorch
- RoBERTa (análise de textos)
- Vision Transformer (ViT) (análise de imagens)

### Controle de Versão

- Git
- GitHub

---

## Datasets Utilizados

### Texto

- LIAR Dataset
- ISOT Fake News Dataset
- Fake and Real News Dataset

### Imagem

- CIFAKE Dataset
- Real and AI Generated Images Dataset

---

## Arquitetura do Sistema

Usuário

↓

Interface Web

↓

Modelo de IA

↓

Resultado da Análise

↓

Percentual de Confiança

---

## Funcionalidades

- Login de usuário
- Upload de textos
- Upload de imagens
- Análise automática por IA
- Exibição do resultado em tempo real
- Exibição da porcentagem de confiança
- Histórico de análises

---

## Funcionamento

### Análise de Texto

1. O usuário envia um texto.
2. O modelo RoBERTa processa o conteúdo.
3. O sistema classifica o texto.
4. É retornado o resultado com o percentual de confiança.

### Análise de Imagem

1. O usuário envia uma imagem.
2. O modelo Vision Transformer (ViT) analisa os padrões visuais.
3. O sistema determina se a imagem foi gerada por IA ou não.
4. É exibido o resultado com o percentual de confiança.

---

## Estrutura do Projeto

AI-Detection-Website/

├── frontend/

│ ├── html

│ ├── css

│ └── javascript

│

├── backend/

│ ├── api

│ ├── models

│ └── database

│

├── datasets/

│

├── trained_models/

│

└── README.md

---

## Equipe

Projeto desenvolvido como trabalho acadêmico para aplicação de técnicas de Inteligência Artificial na detecção de conteúdo digital.

---

## Licença

Este projeto possui fins educacionais e acadêmicos

