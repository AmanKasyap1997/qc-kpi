-- CreateTable
CREATE TABLE "zendesk_tickets" (
    "id" SERIAL NOT NULL,
    "ticket_id" INTEGER NOT NULL,
    "subject" TEXT,
    "status" VARCHAR(50),
    "priority" VARCHAR(50),
    "assignee_id" BIGINT,
    "requester_id" BIGINT,
    "group_id" BIGINT,
    "form_id" BIGINT,
    "entity" VARCHAR(20),
    "webhook_trigger" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zendesk_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "zendesk_tickets_ticket_id_key" ON "zendesk_tickets"("ticket_id");
