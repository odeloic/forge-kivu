CREATE TABLE "project_phases" (
	"project_id" uuid NOT NULL,
	"phase" "project_phase" NOT NULL,
	"completed_on" date NOT NULL,
	CONSTRAINT "project_phases_project_id_phase_pk" PRIMARY KEY("project_id","phase")
);
--> statement-breakpoint
ALTER TABLE "project_phases" ADD CONSTRAINT "project_phases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;