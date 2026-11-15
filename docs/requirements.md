# AI Freelancing Platform — Requirements Draft

## Purpose

Connect clients who need AI-related projects with freelancers who provide AI skills and services.

## User Roles

- Client
- Freelancer
- Admin
- Manager

## Functional Requirements

1. Users can register and log in.
2. Clients can manage their profiles and create projects.
3. Clients can specify project descriptions, budgets, deadlines and required skills.
4. Freelancers can manage their profiles, skills and offered services.
5. Freelancers can browse open projects and submit proposals.
6. Clients can view proposals for their own projects and select a freelancer.
7. The system records assignments and project progress.
8. The system records payments and calculates outstanding balances.
9. Clients and freelancers can review each other after project completion.
10. Admins can manage accounts, skills and service categories.
11. Managers can view project, user, service and payment reports.

## Proposed Business Rules

1. Each user account has a unique email address.
2. Each project belongs to one client.
3. A freelancer can have multiple skills and offer multiple services.
4. A project can require multiple skills.
5. A freelancer can submit only one proposal per project.
6. A project can receive proposals from multiple freelancers.
7. A project can have at most one assignment in the first version.
8. An assignment must refer to a proposal submitted for that project.
9. A project can have multiple payment records.
10. Successful payments must not exceed the agreed assignment amount.
11. Only the assigned client and freelancer can review each other after completion.
12. Each participant can submit one review per completed assignment.
13. Ratings must be whole numbers from 1 to 5.

## Initial Scope

Payments are recorded for demonstration. A live payment gateway, live chat and a mobile app are future improvements.
